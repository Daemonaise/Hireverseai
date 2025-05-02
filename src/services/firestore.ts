'use server';

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
  collectionGroup,
  type Firestore,
  type Timestamp as FirestoreTimestamp,
  type FieldValue,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Freelancer, FreelancerStatus } from '@/types/freelancer';
import type { Project, ProjectStatus, Microtask, ChangeRequest } from '@/types/project';
import type { AdaptiveAssessmentResult } from '@/types/assessment';
import type { Client } from '@/types/client';
import { authenticator } from 'otplib';
import type Stripe from 'stripe';

// --- Setup and Helpers ---
// Cast imported `db` to Firestore so it carries the correct type everywhere.
const firestoreDB: Firestore = db as Firestore;

const freelancersRef = collection(firestoreDB, 'freelancers');
const projectsRef     = collection(firestoreDB, 'projects');
const assessmentsRef  = collection(firestoreDB, 'assessments');
const clientsRef      = collection(firestoreDB, 'clients');

const now = (): FirestoreTimestamp => serverTimestamp() as FirestoreTimestamp;
const getDocRef = (collectionName: string, id: string) => doc(firestoreDB, collectionName, id);

// --- MFA ---
export function generateMfaSecret() {
  return authenticator.generateSecret();
}

export function generateMfaUri(accountName: string, issuer: string, secret: string) {
  return authenticator.keyuri(accountName, issuer, secret);
}

export function verifyMfaToken(secret: string, token: string) {
  try {
    return authenticator.verify({ secret, token });
  } catch {
    return false;
  }
}

export async function storeUserMfaSecret(userId: string, secret: string, userType: 'client' | 'freelancer') {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    await updateDoc(getDocRef(collectionName, userId), {
        mfaSecret: secret,
        isMfaEnabled: false, // Keep disabled until verified
        updatedAt: now(),
    });
}

export async function enableUserMfa(userId: string, userType: 'client' | 'freelancer') {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    await updateDoc(getDocRef(collectionName, userId), {
        isMfaEnabled: true,
        updatedAt: now(),
    });
}

export async function getUserMfaSecret(userId: string, userType: 'client' | 'freelancer'): Promise<string | null> {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    const docSnap = await getDoc(getDocRef(collectionName, userId));
    if (docSnap.exists()) {
        return docSnap.data()?.mfaSecret || null;
    }
    console.error(`Could not find user document for ${userType} ${userId} to get MFA secret.`);
    return null;
}

export async function isUserMfaEnabled(userId: string, userType: 'client' | 'freelancer'): Promise<boolean> {
    const collectionName = userType === 'client' ? 'clients' : 'freelancers';
    const docSnap = await getDoc(getDocRef(collectionName, userId));
    if (docSnap.exists()) {
        return docSnap.data()?.isMfaEnabled === true;
    }
    console.warn(`Could not determine MFA status for ${userType} ${userId}. Assuming disabled.`);
    return false;
}


// --- Core Firestore Actions ---
export async function addFreelancer({ id, name, email }: Pick<Freelancer, 'id' | 'name' | 'email'>): Promise<string> {
  await setDoc(getDocRef('freelancers', id), {
    name,
    email,
    skills: [],
    xp: 0,
    badges: [],
    isLoggedIn: false,
    status: 'offline',
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

export async function addClient({ id, name, email }: Pick<Client, 'id' | 'name' | 'email'>): Promise<string> {
  await setDoc(getDocRef('clients', id), {
    name,
    email,
    mfaSecret: null,
    isMfaEnabled: false,
    subscriptionStatus: 'inactive',
    stripeSubscriptionId: null,
    createdAt: now(),
    updatedAt: now(),
  });
  return id; // Return the ID used
}

export async function updateFreelancerSkills(freelancerId: string, skills: string[]) {
  await updateDoc(getDocRef('freelancers', freelancerId), {
    skills,
    updatedAt: now(),
  });
}

export async function updateFreelancerStatus(freelancerId: string, status?: FreelancerStatus, isLoggedIn?: boolean) {
  const updateData: Partial<Freelancer> & { updatedAt: FirestoreTimestamp } = { updatedAt: now() };
  if (isLoggedIn !== undefined) {
    updateData.isLoggedIn = isLoggedIn;
    // Only set to available on login, keep current status otherwise if logging out or status is explicitly set
    if (isLoggedIn && !status) {
         updateData.status = 'available';
    } else if (!isLoggedIn) {
         updateData.status = 'offline';
    }
  }
  if (status) { // Explicit status update takes precedence if provided
    updateData.status = status;
    if (status === 'offline') updateData.isLoggedIn = false; // Ensure logged out if offline
  }
  await updateDoc(getDocRef('freelancers', freelancerId), updateData);
}

export async function awardXp(freelancerId: string, amount: number) {
  if (amount === 0) return;
  await updateDoc(getDocRef('freelancers', freelancerId), {
    xp: increment(amount),
    updatedAt: now(),
  });
}

export async function awardBadge(freelancerId: string, badgeId: string) {
  await updateDoc(getDocRef('freelancers', freelancerId), {
    badges: arrayUnion(badgeId),
    xp: increment(50),
    updatedAt: now(),
  });
}

// Stores the result of an adaptive assessment and updates the freelancer's profile
export async function storeAssessmentResult(assessment: AdaptiveAssessmentResult): Promise<string> {
  const assessmentRef = doc(collection(assessmentsRef)); // Create a reference for the new assessment doc
  const batch = writeBatch(firestoreDB);

  // 1. Set the assessment document data
  batch.set(assessmentRef, {
    ...assessment,
    id: assessmentRef.id, // Store the auto-generated ID within the document
    completedAt: now(),
  });

  // 2. Update the freelancer document
  batch.update(getDocRef('freelancers', assessment.freelancerId), {
    assessmentResultId: assessmentRef.id, // Link freelancer to the assessment result
    // Optionally update skills based on assessment (if needed)
    // skills: assessment.allSkills, // Or derive from high-scored skills
    badges: arrayUnion('onboarding-complete'), // Award badge
    xp: increment(50 + Math.round(assessment.finalScore / 5)), // Award XP based on score
    updatedAt: now(),
  });

  // Commit the batch write
  await batch.commit();
  console.log(`Assessment result ${assessmentRef.id} saved for freelancer ${assessment.freelancerId}`);
  return assessmentRef.id; // Return the ID of the newly created assessment document
}


export async function getFreelancerById(id: string): Promise<Freelancer | null> {
  const snap = await getDoc(getDocRef('freelancers', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Freelancer : null;
}

export async function getClientById(id: string): Promise<Client | null> {
  const snap = await getDoc(getDocRef('clients', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Client : null;
}

export async function getAvailableFreelancersBySkill(skills: string[], max = 10): Promise<Freelancer[]> {
  const q = query(
    freelancersRef,
    where('isLoggedIn', '==', true),
    where('status', '==', 'available'),
    orderBy('xp', 'desc'),
    limit(max * 5)
  );
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer));
  return all.filter(f => skills.some(s => f.skills.includes(s))).slice(0, max);
}

export async function assignProjectToFreelancer(freelancerId: string, projectId: string) {
  const batch = writeBatch(firestoreDB);
  batch.update(getDocRef('freelancers', freelancerId), {
    currentProjects: arrayUnion(projectId),
    status: 'busy',
    updatedAt: now(),
  });
  batch.update(getDocRef('projects', projectId), {
    assignedFreelancerId: freelancerId,
    status: 'assigned',
    updatedAt: now(),
  });
  await batch.commit();
}

export async function unassignProjectFromFreelancer(freelancerId: string, projectId: string) {
    const batch = writeBatch(firestoreDB);
    batch.update(getDocRef('freelancers', freelancerId), {
        currentProjects: (firestoreDB as any).FieldValue.arrayRemove(projectId), // Use FieldValue for array removal
        status: 'available', // Or check if other projects exist before setting to available
        updatedAt: now(),
    });
    // Optionally update project status (e.g., back to 'decomposed' or 'review')
    // batch.update(getDocRef('projects', projectId), { status: 'review', updatedAt: now() });
    await batch.commit();
}


export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  await updateDoc(getDocRef('projects', projectId), {
    status,
    updatedAt: now(),
  });
}

export async function updateProjectMicrotasks(projectId: string, microtasks: Microtask[]) {
  const projectRef = getDocRef('projects', projectId);
  const batch = writeBatch(firestoreDB);

  // remove existing
  const snapshot = await getDocs(collection(projectRef, 'microtasks'));
  snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));

  // set new
  microtasks.forEach(task => {
    const ref = doc(collection(projectRef, 'microtasks'), task.id);
    batch.set(ref, { ...task, createdAt: now(), updatedAt: now() }); // Ensure createdAt is set here
  });

  batch.update(projectRef, { status: 'decomposed', updatedAt: now() });
  await batch.commit();
}


export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
    const q = query(projectsRef, where("clientId", "==", clientId), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
}


export async function getAssignedProjects(freelancerId: string): Promise<Project[]> {
    const q = query(projectsRef, where("assignedFreelancerId", "==", freelancerId), where("status", "not-in", ["completed", "cancelled"]));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
}


// Get top N freelancers based on XP
export async function getTopFreelancers(count: number): Promise<Freelancer[]> {
    const q = query(freelancersRef, orderBy("xp", "desc"), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Freelancer));
}

// Update freelancer test score for a specific skill
export async function updateFreelancerTestScore(freelancerId: string, skill: string, score: number): Promise<void> {
    const docRef = getDocRef('freelancers', freelancerId);
    await updateDoc(docRef, {
        [`testScores.${skill}`]: score, // Use dot notation to update nested field
        updatedAt: now(),
    });
}

// Get assessment status for a freelancer
export async function getFreelancerAssessmentStatus(freelancerId: string): Promise<'completed' | 'in-progress' | 'not-started'> {
    const freelancer = await getFreelancerById(freelancerId);
    if (freelancer?.assessmentResultId) {
        // Could add a check here to see if the assessment document actually exists if needed
        return 'completed';
    }
    // If no assessmentResultId, assume not started.
    // 'in-progress' state would need more complex tracking (e.g., a field on the freelancer doc).
    return 'not-started';
}


// --- Change Request Functions ---

/**
 * Adds a new change request to a project's subcollection.
 * @returns The ID of the newly created change request document.
 */
export async function addChangeRequestToProject(projectId: string, requestData: Omit<ChangeRequest, 'id' | 'requestedAt' | 'status'>): Promise<string> {
    const projectRef = getDocRef('projects', projectId);
    const changeRequestsCol = collection(projectRef, 'changeRequests');
    const newRequestRef = doc(changeRequestsCol); // Auto-generate ID

    const newRequest: ChangeRequest = {
        ...requestData,
        id: newRequestRef.id, // Store the auto-generated ID
        requestedAt: now(),
        status: 'pending_estimate', // Initial status
    };

    await setDoc(newRequestRef, newRequest);
    // Update project status to indicate a change is requested
    await updateDoc(projectRef, { status: 'change_requested', updatedAt: now() });

    return newRequestRef.id;
}

/**
 * Updates an existing change request within a project's subcollection.
 */
export async function updateChangeRequestInProject(projectId: string, requestId: string, updates: Partial<Omit<ChangeRequest, 'id' | 'requestedAt'>>) {
    const requestRef = doc(firestoreDB, `projects/${projectId}/changeRequests`, requestId);
    await updateDoc(requestRef, {
        ...updates,
        updatedAt: now(),
    });
}

// --- Firestore Utils for Project (Example) ---
export async function getProjectById(projectId: string): Promise<Project | null> {
    const snap = await getDoc(getDocRef('projects', projectId));
    return snap.exists() ? { id: snap.id, ...snap.data() } as Project : null;
}


// --- Stripe Related Functions ---
export async function updateClientSubscriptionStatus(
  clientId: string,
  status: Stripe.Subscription.Status | 'inactive', // Allow 'inactive'
  subscriptionId: string | null
) {
  await updateDoc(getDocRef('clients', clientId), {
    subscriptionStatus: status,
    stripeSubscriptionId: subscriptionId,
    updatedAt: now(),
  });
}

export async function updateProjectPaymentStatus(
  projectId: string,
  paymentStatus: 'paid' | 'payment_failed' | 'pending'
) {
  // Map payment status to a relevant project status update if needed
  const projectStatusUpdate: Partial<Project> = {};
  if (paymentStatus === 'paid') {
     // Decide what the project status should be after payment (e.g., 'decomposing' or 'pending')
      projectStatusUpdate.status = 'pending'; // Or 'decomposing' if brief is ready
  } else if (paymentStatus === 'payment_failed') {
      projectStatusUpdate.status = 'pending'; // Keep pending or set to a specific 'payment_failed' project status if needed
  }

  await updateDoc(getDocRef('projects', projectId), {
    paymentStatus,
    ...projectStatusUpdate, // Conditionally update project status
    updatedAt: now(),
  });
}


