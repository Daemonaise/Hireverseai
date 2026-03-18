
import {
  collection,
  doc,
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove, // Import arrayRemove
  collectionGroup,
  type Firestore,
  type Timestamp as FirestoreTimestamp,
  type FieldValue,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Freelancer, FreelancerStatus } from '@/types/freelancer';
import type { Project, ProjectStatus, Microtask, ChangeRequest, ProjectPaymentStatus } from '@/types/project';
import type { AdaptiveAssessmentResult } from '@/types/assessment';
import type { Client } from '@/types/client';
import { authenticator } from 'otplib';
import type Stripe from 'stripe';
import { dummyFreelancers } from '@/lib/dummy-data'; // Import dummy data

// --- Setup and Helpers ---
// Cast imported `db` to Firestore so it carries the correct type everywhere.
const firestoreDB: Firestore = db as Firestore;

const freelancersRef = collection(firestoreDB, 'freelancers');
const projectsRef     = collection(firestoreDB, 'projects');
const assessmentsRef  = collection(firestoreDB, 'assessments');
const clientsRef      = collection(firestoreDB, 'clients');

// Use FieldValue type for serverTimestamp for better type safety if possible,
// otherwise cast FirestoreTimestamp for internal use.
const now = (): FieldValue => serverTimestamp();
const getDocRef = (collectionName: string, id: string) => doc(firestoreDB, collectionName, id);

// --- MFA ---
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function generateMfaUri(accountName: string, issuer: string, secret: string): string {
  return authenticator.keyuri(accountName, issuer, secret);
}

export function verifyMfaToken(secret: string, token: string): boolean {
  try {
    // Ensure the token is treated as a string
    return authenticator.verify({ secret, token: String(token) });
  } catch (error){
     return false;
  }
}

export async function storeUserMfaSecret(userId: string, secret: string, userType: 'client' | 'freelancer') {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    try {
        await updateDoc(getDocRef(collectionName, userId), {
            mfaSecret: secret,
            isMfaEnabled: false, // Keep disabled until verified by user
            updatedAt: now(),
        });
    } catch (error) {
        throw new Error(`Failed to store MFA secret.`); // Re-throw for caller handling
    }
}

export async function enableUserMfa(userId: string, userType: 'client' | 'freelancer') {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    try {
        await updateDoc(getDocRef(collectionName, userId), {
            isMfaEnabled: true,
            updatedAt: now(),
        });
    } catch (error) {
        throw new Error(`Failed to enable MFA.`); // Re-throw for caller handling
    }
}

export async function getUserMfaSecret(userId: string, userType: 'client' | 'freelancer'): Promise<string | null> {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    try {
        const docSnap = await getDoc(getDocRef(collectionName, userId));
        if (docSnap.exists()) {
            return docSnap.data()?.mfaSecret || null;
        }
        return null; // Explicitly return null if user doc not found
    } catch (error) {
         throw new Error('Failed to fetch MFA secret.'); // Re-throw for caller handling
    }
}

export async function isUserMfaEnabled(userId: string, userType: 'client' | 'freelancer'): Promise<boolean> {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
     try {
        const docSnap = await getDoc(getDocRef(collectionName, userId));
        if (docSnap.exists()) {
            return docSnap.data()?.isMfaEnabled === true;
        }
        return false;
     } catch (error) {
        // Decide on fallback behavior: assuming false is safer.
        return false;
     }
}


// --- Core Firestore Actions ---

// Creates a new freelancer document. ID should ideally come from Firebase Auth.
export async function addFreelancer({ id, name, email }: Pick<Freelancer, 'id' | 'name' | 'email'>): Promise<string> {
  const docRef = getDocRef('freelancers', id);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
      // Optionally update if needed, but for signup, usually skip or error
      // await updateDoc(docRef, { name, email, updatedAt: now() });
      return id;
  }

  await setDoc(docRef, {
    name,
    email,
    skills: [],
    xp: 0,
    badges: [],
    isLoggedIn: false, // Start as logged out
    status: 'offline', // Start as offline
    currentProjects: [],
    testScores: {},
    assessmentResultId: null,
    mfaSecret: null,
    isMfaEnabled: false,
    createdAt: now(),
    updatedAt: now(),
  });
  return id; // Return the ID used
}


// Creates a new client document. ID should ideally come from Firebase Auth.
export async function addClient({ id, name, email }: Pick<Client, 'id' | 'name' | 'email'>): Promise<string> {
    const docRef = getDocRef('clients', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        // Optionally update if needed
        // await updateDoc(docRef, { name, email, updatedAt: now() });
        return id;
    }

    await setDoc(docRef, {
        name,
        email,
        mfaSecret: null,
        isMfaEnabled: false,
        subscriptionStatus: 'inactive', // Start as inactive
        stripeSubscriptionId: null,
        createdAt: now(),
        updatedAt: now(),
    });
    return id; // Return the ID used
}

export async function updateFreelancerSkills(freelancerId: string, skills: string[]) {
  try {
    await updateDoc(getDocRef('freelancers', freelancerId), {
      skills,
      updatedAt: now(),
    });
  } catch (error) {
    throw new Error('Failed to update freelancer skills.');
  }
}

export async function updateFreelancerStatus(freelancerId: string, status?: FreelancerStatus, isLoggedIn?: boolean) {
  const updateData: Partial<Freelancer> & { updatedAt: FieldValue } = { updatedAt: now() };

  // Determine final status and login state based on inputs
  let finalStatus: FreelancerStatus | undefined = status;
  let finalIsLoggedIn: boolean | undefined = isLoggedIn;

  if (isLoggedIn === true && !status) {
      finalStatus = 'available'; // Default to available on login if no status specified
      finalIsLoggedIn = true;
  } else if (isLoggedIn === false) {
      finalStatus = 'offline'; // Force offline if logging out
      finalIsLoggedIn = false;
  } else if (status === 'offline') {
      finalIsLoggedIn = false; // Ensure logged out if status is explicitly set to offline
  } else if (status && isLoggedIn === undefined) {
      // If status is set but isLoggedIn is not, assume login state doesn't change unless status is offline
      finalIsLoggedIn = status === 'offline' ? false : undefined;
  }

   // Only proceed if there are actual changes to make
   if (Object.keys(updateData).length > 1) {
      try {
        await updateDoc(getDocRef('freelancers', freelancerId), updateData);
      } catch (error) {
        throw new Error('Failed to update freelancer status.');
      }
   } else {
   }
}

export async function updateFreelancer(freelancerId: string, data: Record<string, unknown>) {
  await updateDoc(getDocRef('freelancers', freelancerId), {
    ...data,
    updatedAt: now(),
  });
}

export async function updateFreelancerByStripeAccount(stripeAccountId: string, data: Record<string, unknown>) {
  const q = query(getColRef('freelancers'), where('stripeAccountId', '==', stripeAccountId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const freelancerDoc = snap.docs[0];
  await updateDoc(freelancerDoc.ref, {
    ...data,
    updatedAt: now(),
  });
}

export async function awardXp(freelancerId: string, amount: number) {
  if (amount === 0) return;
   try {
      await updateDoc(getDocRef('freelancers', freelancerId), {
        xp: increment(amount),
        updatedAt: now(),
      });
   } catch (error) {
      // Decide if this should throw or just log
   }
}

export async function awardBadge(freelancerId: string, badgeId: string) {
   try {
      await updateDoc(getDocRef('freelancers', freelancerId), {
        badges: arrayUnion(badgeId),
        xp: increment(50), // Example: Award XP for badges
        updatedAt: now(),
      });
   } catch (error) {
      // Decide if this should throw or just log
   }
}

// Stores the result of an adaptive assessment and updates the freelancer's profile
export async function storeAssessmentResult(assessment: AdaptiveAssessmentResult): Promise<string> {
  const assessmentRef = doc(collection(assessmentsRef)); // Create a reference for the new assessment doc
  const freelancerRef = getDocRef('freelancers', assessment.freelancerId);
  const batch = writeBatch(firestoreDB);

  try {
      // 1. Set the assessment document data
      batch.set(assessmentRef, {
        ...assessment,
        id: assessmentRef.id, // Store the auto-generated ID within the document
        // Ensure Timestamps are correctly handled if passed directly
        completedAt: assessment.completedAt instanceof Date ? assessment.completedAt : now(),
      });

      // 2. Update the freelancer document
      batch.update(freelancerRef, {
        assessmentResultId: assessmentRef.id, // Link freelancer to the assessment result
        // Optionally update skills based on assessment (if needed)
        // skills: assessment.allSkills, // Or derive from high-scored skills
        badges: arrayUnion('onboarding-complete'), // Award badge
        xp: increment(50 + Math.round(assessment.finalScore / 5)), // Award XP based on score
        updatedAt: now(),
      });

      // Commit the batch write
      await batch.commit();
      return assessmentRef.id; // Return the ID of the newly created assessment document
  } catch (error) {
      throw new Error('Failed to store assessment result.');
  }
}


export async function getFreelancerById(id: string): Promise<Freelancer | null> {
   try {
     const freelancer = dummyFreelancers.find(f => f.id === id);
     return freelancer ? { ...freelancer } : null; // Return a copy to prevent mutation
   } catch (error) {
      throw new Error('Failed to fetch freelancer data.');
   }
}

export async function getClientById(id: string): Promise<Client | null> {
   try {
      const snap = await getDoc(getDocRef('clients', id));
      return snap.exists() ? { id: snap.id, ...snap.data() } as Client : null;
   } catch (error) {
       throw new Error('Failed to fetch client data.');
   }
}

// Fetches freelancers available for work based on skills.
export async function getAvailableFreelancersBySkill(skills: string[], max = 10): Promise<Freelancer[]> {
  if (!skills || skills.length === 0) return [];

  const q = query(
    freelancersRef,
    where('isLoggedIn', '==', true),
    where('status', '==', 'available'),
    // Firestore limitation: Cannot query array containment on multiple fields simultaneously
    // Query for skills individually or filter client-side (less efficient for large datasets)
    // Option 1: Query for one skill (less flexible)
    // where('skills', 'array-contains-any', skills.slice(0, 10)), // Limit array-contains-any to 10 elements
    orderBy('xp', 'desc'),
    limit(max * 5) // Fetch more initially to filter based on multiple skills client-side
  );

  try {
    const snap = await getDocs(q);
    const allAvailable = snap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer));

    // Client-side filtering for multiple skills
    const filtered = allAvailable.filter(f => skills.some(s => (f.skills || []).includes(s)));
    return filtered.slice(0, max); // Return the top 'max' matching freelancers

  } catch (error) {
      throw new Error('Failed to fetch available freelancers.');
  }
}

export async function assignProjectToFreelancer(freelancerId: string, projectId: string) {
  const batch = writeBatch(firestoreDB);
  const freelancerRef = getDocRef('freelancers', freelancerId);
  const projectRef = getDocRef('projects', projectId);

  try {
      batch.update(freelancerRef, {
        currentProjects: arrayUnion(projectId),
        status: 'busy', // Set freelancer to busy when assigned
        updatedAt: now(),
      });
      batch.update(projectRef, {
        assignedFreelancerId: freelancerId,
        status: 'assigned', // Set project status to assigned
        updatedAt: now(),
      });
      await batch.commit();
  } catch (error) {
      throw new Error('Failed to assign project.');
  }
}

export async function unassignProjectFromFreelancer(freelancerId: string, projectId: string) {
    const batch = writeBatch(firestoreDB);
    const freelancerRef = getDocRef('freelancers', freelancerId);
    const projectRef = getDocRef('projects', projectId); // Optional: for updating project status

    try {
        batch.update(freelancerRef, {
            currentProjects: arrayRemove(projectId), // Use arrayRemove
            // Decide on status: maybe check if they have other projects before setting to 'available'?
            // For simplicity, setting to available here.
            status: 'available',
            updatedAt: now(),
        });
        // Optionally update project status (e.g., back to 'review')
        batch.update(projectRef, {
            assignedFreelancerId: null, // Remove assignment
            // status: 'review', // Example: Set status if needed
            updatedAt: now()
        });
        await batch.commit();
    } catch (error) {
         throw new Error('Failed to unassign project.');
    }
}


export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
   try {
      await updateDoc(getDocRef('projects', projectId), {
        status,
        updatedAt: now(),
      });
   } catch (error) {
       throw new Error('Failed to update project status.');
   }
}

// Updates microtasks for a project, overwriting existing ones.
export async function updateProjectMicrotasks(projectId: string, microtasks: Microtask[]) {
  const projectRef = getDocRef('projects', projectId);
  const microtasksColRef = collection(projectRef, 'microtasks');
  const batch = writeBatch(firestoreDB);

  try {
    // Fetch existing microtask IDs to delete them efficiently
    const existingSnapshot = await getDocs(microtasksColRef);
    existingSnapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));

    // Add new microtasks
    microtasks.forEach(task => {
      // Ensure task has an ID, generate one if needed (though AI should provide it)
      const taskId = task.id || doc(microtasksColRef).id;
      const ref = doc(microtasksColRef, taskId);
      batch.set(ref, {
        ...task,
        id: taskId, // Ensure ID is set in the document data
        // Ensure Timestamps are correctly set
        createdAt: task.createdAt instanceof Date ? task.createdAt : now(),
        updatedAt: now()
      });
    });

    // Update project status to 'decomposed' after microtasks are set
    batch.update(projectRef, { status: 'decomposed', updatedAt: now() });

    await batch.commit();

  } catch (error) {
      throw new Error('Failed to update project microtasks.');
  }
}


export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
    const q = query(projectsRef, where("clientId", "==", clientId), orderBy("createdAt", "desc"));
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    } catch (error) {
        throw new Error('Failed to fetch client projects.');
    }
}


export async function getAssignedProjects(freelancerId: string): Promise<Project[]> {
    const q = query(projectsRef, where("assignedFreelancerId", "==", freelancerId), where("status", "not-in", ["completed", "cancelled"]));
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
    } catch (error) {
        throw new Error('Failed to fetch assigned projects.');
    }
}


// Get top N freelancers based on XP
export async function getTopFreelancers(count: number): Promise<Freelancer[]> {
    try {
        // Sort dummy data by XP in descending order
        const sortedFreelancers = [...dummyFreelancers].sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
        // Return the top N freelancers
        return Promise.resolve(sortedFreelancers.slice(0, count));
    } catch (error) {
        throw new Error('Failed to fetch leaderboard.');
    }
}

// Update freelancer test score for a specific skill
export async function updateFreelancerTestScore(freelancerId: string, skill: string, score: number): Promise<void> {
    const docRef = getDocRef('freelancers', freelancerId);
    try {
        await updateDoc(docRef, {
            [`testScores.${skill}`]: score, // Use dot notation for nested field
            updatedAt: now(),
        });
    } catch (error) {
        // Decide if this should throw
    }
}

// Get assessment status for a freelancer
export async function getFreelancerAssessmentStatus(freelancerId: string): Promise<'completed' | 'in-progress' | 'not-started'> {
    try {
        const freelancer = await getFreelancerById(freelancerId); // Reuse existing function
        if (freelancer?.assessmentResultId) {
            // Add check if assessment doc exists if needed
            // const assessmentDoc = await getDoc(doc(assessmentsRef, freelancer.assessmentResultId));
            // return assessmentDoc.exists() ? 'completed' : 'in-progress'; // Or handle missing assessment doc
            return 'completed';
        }
        // If no assessmentResultId, assume not started.
        // 'in-progress' state would need more complex tracking (e.g., a field on the freelancer doc).
        return 'not-started';
    } catch (error) {
        // Return a default/safe status on error
        return 'not-started';
    }
}


// --- Change Request Functions ---

/**
 * Adds a new change request to a project's subcollection.
 * @returns The ID of the newly created change request document.
 */
export async function addChangeRequestToProject(projectId: string, requestData: Omit<ChangeRequest, 'id' | 'requestedAt' | 'status' | 'updatedAt'>): Promise<string> {
    const projectRef = getDocRef('projects', projectId);
    const changeRequestsCol = collection(projectRef, 'changeRequests');
    const newRequestRef = doc(changeRequestsCol); // Auto-generate ID

    const newRequest: ChangeRequest = {
        ...requestData,
        id: newRequestRef.id, // Store the auto-generated ID
        requestedAt: now() as FirestoreTimestamp, // Assign current server time
        status: 'pending_estimate', // Initial status
    };

    try {
        await setDoc(newRequestRef, newRequest);
        // Update project status to indicate a change is requested
        await updateDoc(projectRef, { status: 'change_requested', updatedAt: now() });
        return newRequestRef.id;
    } catch (error) {
         throw new Error('Failed to add change request.');
    }
}

/**
 * Updates an existing change request within a project's subcollection.
 */
export async function updateChangeRequestInProject(projectId: string, requestId: string, updates: Partial<Omit<ChangeRequest, 'id' | 'requestedAt'>>) {
    const requestRef = doc(firestoreDB, `projects/${projectId}/changeRequests`, requestId);
    try {
        await updateDoc(requestRef, {
            ...updates,
            updatedAt: now(), // Always update the timestamp
        });
    } catch (error) {
         throw new Error('Failed to update change request.');
    }
}

// --- Firestore Utils for Project ---
export async function getProjectById(projectId: string): Promise<Project | null> {
    try {
        const snap = await getDoc(getDocRef('projects', projectId));
        return snap.exists() ? { id: snap.id, ...snap.data() } as Project : null;
    } catch (error) {
         throw new Error('Failed to fetch project data.');
    }
}


// --- Stripe Related Functions (Webhook Handlers) ---

/**
 * Updates client subscription status in Firestore based on Stripe webhook event.
 * @param clientId - The client's ID in your system (likely client_reference_id from Stripe session).
 * @param status - The new subscription status from Stripe.
 * @param subscriptionId - The Stripe subscription ID.
 */
export async function handleClientSubscriptionUpdate(
  clientId: string,
  status: Stripe.Subscription.Status | 'inactive',
  subscriptionId: string | null
) {
  const clientRef = getDocRef('clients', clientId);
  try {
    await updateDoc(clientRef, {
      subscriptionStatus: status,
      stripeSubscriptionId: subscriptionId,
      updatedAt: now(),
    });
  } catch (error) {
    // Consider adding more robust error handling/logging here
  }
}

/**
 * Updates project payment status in Firestore based on Stripe webhook event.
 * @param projectId - The project's ID stored in Stripe PaymentIntent metadata.
 * @param paymentStatus - The derived payment status ('paid', 'payment_failed').
 */
export async function handleProjectPaymentUpdate(
  projectId: string,
  paymentStatus: ProjectPaymentStatus // Use the defined type
) {
  const projectRef = getDocRef('projects', projectId);
  const updates: Partial<Project> = {
    paymentStatus: paymentStatus,
    updatedAt: now(),
  };

  // Update project status based on payment outcome
  if (paymentStatus === 'paid') {
    // Project is paid, move to the next step (e.g., 'decomposing' or 'pending')
    // Check if brief exists to decide status?
    updates.status = 'pending'; // Or 'decomposing'
  } else if (paymentStatus === 'payment_failed') {
    // Payment failed, potentially keep as 'pending' or a specific failed state
    updates.status = 'pending'; // Keep pending, client needs to retry payment
  }

  try {
    await updateDoc(projectRef, updates);
  } catch (error) {
    // Consider adding more robust error handling/logging here
  }
}


// --- Authentication Related Functions (Placeholders/Simulations) ---

// Replace with actual Firebase Auth user creation
export async function createAuthUser(email: string, password: string): Promise<{ userId: string } | null> {
    // In a real app:
    // try {
    //   const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    //   return { userId: userCredential.user.uid };
    // } catch (error) {
    //   console.error("Firebase Auth creation failed:", error);
    //   // Map Firebase auth errors (e.g., 'auth/email-already-in-use') to user-friendly messages
    //   if ((error as any).code === 'auth/email-already-in-use') {
    //       throw new Error("Email address is already in use.");
    //   }
    //   throw new Error("Failed to create authentication account.");
    // }

    // Placeholder logic:
    if (!email || !password) {
        throw new Error("Email and password are required.");
    }
    // Simulate success, generate a consistent ID based on email for demo
    const simulatedId = `auth-${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')}-${Date.now() % 1000}`;
    return { userId: simulatedId };
}

// Replace with actual Firebase Auth sign-in
export async function signInAuthUser(email: string, password: string): Promise<{ userId: string } | null> {
    // In a real app:
    // try {
    //   const userCredential = await signInWithEmailAndPassword(auth, email, password);
    //   return { userId: userCredential.user.uid };
    // } catch (error) {
    //   console.error("Firebase Auth sign-in failed:", error);
    //    // Map Firebase auth errors (e.g., 'auth/invalid-credential')
    //    if ((error as any).code === 'auth/invalid-credential') {
    //        throw new Error("Invalid email or password.");
    //    }
    //   throw new Error("Login failed. Please check your credentials.");
    // }

    // Placeholder logic:
    if (password === 'password') { // Simple check for demo
        // Derive a consistent ID based on email
        const simulatedId = `auth-${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '')}`;
        return { userId: simulatedId };
    }
    throw new Error("Invalid email or password."); // Simulate auth failure
}

// --- Project Creation from External Source ---
interface ExternalProjectData {
  name: string;
  brief: string;
  requiredSkills: string[];
  clientId: string;
  externalProjectId?: string; // Optional ID from the source system
}

/**
 * Creates a new project document in Firestore from an external source.
 * @param projectData - The project details.
 * @returns The ID of the newly created project document.
 */
export async function createProjectFromExternal(projectData: ExternalProjectData): Promise<string> {
  const newProjectRef = doc(projectsRef); // Auto-generate ID for the new project

  const projectDocument: Project = {
    id: newProjectRef.id,
    clientId: projectData.clientId,
    name: projectData.name,
    brief: projectData.brief,
    requiredSkills: projectData.requiredSkills,
    status: 'pending', // Initial status for externally created projects
    paymentStatus: 'pending', // Payment will need to be handled
    // assignedFreelancerId will be set later by the matching flow
    // microtasks and changeRequests are subcollections
    // estimatedDeliveryDate will be set later
    createdAt: now() as FirestoreTimestamp,
    updatedAt: now() as FirestoreTimestamp,
    // Optionally store the external ID
    ...(projectData.externalProjectId && { externalSourceData: { id: projectData.externalProjectId, system: 'UnknownExternal' } }), // Example, refine as needed
  };

  try {
    await setDoc(newProjectRef, projectDocument);
    return newProjectRef.id;
  } catch (error) {
    throw new Error('Failed to create project from external source.');
  }
}
