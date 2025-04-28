
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDoc, setDoc, query, orderBy, limit, getDocs, arrayUnion, where, Timestamp, writeBatch, increment, arrayRemove, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Freelancer, FreelancerStatus } from '@/types/freelancer';
import type { Project, ProjectStatus, ChangeRequest, Microtask } from '@/types/project';
import type { AdaptiveAssessmentResult } from '@/types/assessment';
import type { Client } from '@/types/client'; // Import Client type
import { authenticator } from 'otplib'; // Import otplib
import type Stripe from 'stripe'; // Import Stripe type

const FREELANCERS_COLLECTION = 'freelancers';
const PROJECTS_COLLECTION = 'projects';
const ASSESSMENTS_COLLECTION = 'assessments';
const CLIENTS_COLLECTION = 'clients'; // Define clients collection name
const CHANGE_REQUESTS_SUBCOLLECTION = 'changeRequests';
const MICROTASKS_SUBCOLLECTION = 'microtasks';

const freelancersCollectionRef = collection(db, FREELANCERS_COLLECTION);
const projectsCollectionRef = collection(db, PROJECTS_COLLECTION);
const assessmentsCollectionRef = collection(db, ASSESSMENTS_COLLECTION);
const clientsCollectionRef = collection(db, CLIENTS_COLLECTION); // Clients collection reference

// --- Helper Functions ---
function getFreelancerDocRef(freelancerId: string) {
    return doc(db, FREELANCERS_COLLECTION, freelancerId);
}
function getClientDocRef(clientId: string) { // Helper for clients
    return doc(db, CLIENTS_COLLECTION, clientId);
}
function getProjectDocRef(projectId: string) {
    return doc(db, PROJECTS_COLLECTION, projectId);
}
function getAssessmentDocRef(assessmentId: string) {
    return doc(db, ASSESSMENTS_COLLECTION, assessmentId);
}
function getChangeRequestDocRef(projectId: string, changeRequestId: string) {
    return doc(db, PROJECTS_COLLECTION, projectId, CHANGE_REQUESTS_SUBCOLLECTION, changeRequestId);
}
function getMicrotaskDocRef(projectId: string, microtaskId: string) {
    return doc(db, PROJECTS_COLLECTION, projectId, MICROTASKS_SUBCOLLECTION, microtaskId);
}

// --- Default Data & Mappers ---

const defaultFreelancerData = (): Omit<Freelancer, 'id' | 'email' | 'name' | 'createdAt'> => ({
    skills: [],
    xp: 0,
    badges: [],
    isLoggedIn: false,
    status: 'offline',
    currentProjects: [],
    testScores: {},
    assessmentResultId: null,
    mfaSecret: null, // Initialize MFA fields
    isMfaEnabled: false,
    updatedAt: serverTimestamp() as Timestamp, // Explicit cast for TS strictness
});

const mapDocToFreelancer = (docSnap: FirebaseFirestore.DocumentSnapshot): Freelancer => {
    const data = docSnap.data() ?? {};
    return {
        id: docSnap.id,
        name: data.name ?? 'Unknown Name',
        email: data.email ?? 'Unknown Email',
        skills: Array.isArray(data.skills) ? data.skills : [],
        xp: typeof data.xp === 'number' ? data.xp : 0,
        badges: Array.isArray(data.badges) ? data.badges : [],
        isLoggedIn: typeof data.isLoggedIn === 'boolean' ? data.isLoggedIn : false,
        status: ['available', 'busy', 'offline'].includes(data.status) ? data.status : 'offline',
        currentProjects: Array.isArray(data.currentProjects) ? data.currentProjects : [],
        testScores: typeof data.testScores === 'object' && data.testScores !== null ? data.testScores : {},
        assessmentResultId: typeof data.assessmentResultId === 'string' ? data.assessmentResultId : null,
        mfaSecret: typeof data.mfaSecret === 'string' ? data.mfaSecret : null, // Map MFA fields
        isMfaEnabled: typeof data.isMfaEnabled === 'boolean' ? data.isMfaEnabled : false,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
    };
};

const defaultClientData = (): Omit<Client, 'id' | 'email' | 'name' | 'createdAt'> => ({
    mfaSecret: null, // Initialize MFA fields
    isMfaEnabled: false,
    subscriptionStatus: 'inactive', // Add initial subscription status
    stripeSubscriptionId: null,
    updatedAt: serverTimestamp() as Timestamp, // Explicit cast
});

const mapDocToClient = (docSnap: FirebaseFirestore.DocumentSnapshot): Client => {
    const data = docSnap.data() ?? {};
    return {
        id: docSnap.id,
        name: data.name ?? 'Unknown Client Name',
        email: data.email ?? 'Unknown Email',
        mfaSecret: typeof data.mfaSecret === 'string' ? data.mfaSecret : null, // Map MFA fields
        isMfaEnabled: typeof data.isMfaEnabled === 'boolean' ? data.isMfaEnabled : false,
        subscriptionStatus: data.subscriptionStatus ?? 'inactive', // Map subscription status
        stripeSubscriptionId: data.stripeSubscriptionId ?? null, // Map Stripe ID
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
    };
};


// Map other document types (Project, Assessment, ChangeRequest, Microtask) - unchanged...
const mapDocToProject = (docSnap: FirebaseFirestore.DocumentSnapshot): Project => {
    const data = docSnap.data() ?? {};
    return {
        id: docSnap.id,
        clientId: data.clientId ?? 'Unknown Client',
        name: data.name ?? 'Unnamed Project',
        brief: data.brief ?? 'No brief provided.',
        requiredSkills: Array.isArray(data.requiredSkills) ? data.requiredSkills : [],
        status: data.status ?? 'pending', // Ensure status has a default
        paymentStatus: data.paymentStatus ?? 'pending', // Add payment status
        // Microtasks are now in a subcollection, remove from main doc mapping
        // microtasks: Array.isArray(data.microtasks) ? data.microtasks : [],
        // Change requests are now handled in subcollection, remove from main doc mapping if fully migrated
        // changeRequests: Array.isArray(data.changeRequests) ? data.changeRequests : [],
        estimatedDeliveryDate: data.estimatedDeliveryDate instanceof Timestamp ? data.estimatedDeliveryDate : undefined,
        progress: typeof data.progress === 'number' ? data.progress : 0,
        assignedFreelancerId: data.assignedFreelancerId ?? undefined, // Use undefined if not present
        deliveredUrl: data.deliveredUrl ?? undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
    };
};
const mapDocToAssessmentResult = (docSnap: FirebaseFirestore.DocumentSnapshot): AdaptiveAssessmentResult => {
    const data = docSnap.data() ?? {};
    return {
        id: docSnap.id,
        freelancerId: data.freelancerId ?? 'Unknown Freelancer',
        primarySkill: data.primarySkill ?? 'Unknown Skill',
        allSkills: Array.isArray(data.allSkills) ? data.allSkills : [],
        questions: Array.isArray(data.questions) ? data.questions : [],
        finalScore: typeof data.finalScore === 'number' ? data.finalScore : 0,
        certificationLevel: data.certificationLevel ?? 'Uncertified',
        completedAt: data.completedAt instanceof Timestamp ? data.completedAt : Timestamp.now(),
    };
};
const mapDocToChangeRequest = (docSnap: FirebaseFirestore.DocumentSnapshot): ChangeRequest => {
    const data = docSnap.data() ?? {};
    return {
        id: docSnap.id,
        requestedBy: data.requestedBy ?? 'Unknown Client',
        description: data.description ?? 'No description.',
        priority: ['Normal', 'High'].includes(data.priority) ? data.priority : 'Normal',
        fileUrl: data.fileUrl ?? undefined,
        status: ['pending_estimate', 'pending_approval', 'approved', 'rejected', 'cancelled'].includes(data.status) ? data.status : 'pending_estimate',
        estimatedNewCompletionDate: data.estimatedNewCompletionDate instanceof Timestamp ? data.estimatedNewCompletionDate : undefined,
        estimatedAdditionalCost: typeof data.estimatedAdditionalCost === 'number' ? data.estimatedAdditionalCost : undefined,
        requestedAt: data.requestedAt instanceof Timestamp ? data.requestedAt : Timestamp.now(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
    };
};
const mapDocToMicrotask = (docSnap: FirebaseFirestore.DocumentSnapshot): Microtask => {
    const data = docSnap.data() ?? {};
    return {
        id: docSnap.id,
        description: data.description ?? 'No description.',
        status: ['pending', 'assigned', 'in_progress', 'submitted', 'approved', 'rejected'].includes(data.status) ? data.status : 'pending',
        assignedFreelancerId: data.assignedFreelancerId ?? undefined,
        estimatedHours: typeof data.estimatedHours === 'number' ? data.estimatedHours : undefined,
        requiredSkill: data.requiredSkill ?? undefined,
        dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
        submittedWorkUrl: data.submittedWorkUrl ?? undefined,
        feedback: data.feedback ?? undefined,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
    };
};

// --- MFA Helper Functions ---

/** Generates a unique TOTP secret. */
export function generateMfaSecret(): string {
    return authenticator.generateSecret();
}

/** Generates a TOTP URI for QR code generation. */
export function generateMfaUri(accountName: string, issuer: string, secret: string): string {
    return authenticator.keyuri(accountName, issuer, secret);
}

/** Verifies a TOTP code against the stored secret. */
export function verifyMfaToken(secret: string, token: string): boolean {
    try {
        return authenticator.verify({ secret, token });
    } catch (error) {
        console.error("MFA verification error:", error);
        return false; // Verification fails on error
    }
}

/**
 * Updates the user's MFA secret in Firestore. Typically called during signup.
 * Sets isMfaEnabled to false initially.
 * @param userId The ID of the user (client or freelancer).
 * @param secret The generated TOTP secret.
 * @param userType 'client' or 'freelancer'.
 */
export async function storeUserMfaSecret(userId: string, secret: string, userType: 'client' | 'freelancer'): Promise<void> {
    if (!userId || !secret) throw new Error("User ID and secret are required.");
    const docRef = userType === 'client' ? getClientDocRef(userId) : getFreelancerDocRef(userId);
    try {
        await updateDoc(docRef, {
            mfaSecret: secret,
            isMfaEnabled: false, // User must verify to enable
            updatedAt: serverTimestamp(),
        });
        console.log(`MFA secret stored for ${userType} ${userId}. MFA is pending verification.`);
    } catch (error) {
        console.error(`Error storing MFA secret for ${userType} ${userId}:`, error);
        throw new Error(`Failed to store MFA secret. Reason: ${(error as Error).message}`);
    }
}

/**
 * Enables MFA for a user after successful verification of the first token.
 * @param userId The ID of the user (client or freelancer).
 * @param userType 'client' or 'freelancer'.
 */
export async function enableUserMfa(userId: string, userType: 'client' | 'freelancer'): Promise<void> {
    if (!userId) throw new Error("User ID is required.");
    const docRef = userType === 'client' ? getClientDocRef(userId) : getFreelancerDocRef(userId);
    try {
        await updateDoc(docRef, {
            isMfaEnabled: true,
            updatedAt: serverTimestamp(),
        });
        console.log(`MFA enabled for ${userType} ${userId}.`);
    } catch (error) {
        console.error(`Error enabling MFA for ${userType} ${userId}:`, error);
        throw new Error(`Failed to enable MFA. Reason: ${(error as Error).message}`);
    }
}

/**
 * Disables MFA for a user.
 * Requires authentication/verification before calling this function.
 * @param userId The ID of the user (client or freelancer).
 * @param userType 'client' or 'freelancer'.
 */
export async function disableUserMfa(userId: string, userType: 'client' | 'freelancer'): Promise<void> {
    if (!userId) throw new Error("User ID is required.");
    const docRef = userType === 'client' ? getClientDocRef(userId) : getFreelancerDocRef(userId);
    try {
        await updateDoc(docRef, {
            isMfaEnabled: false,
            mfaSecret: null, // Optionally remove the secret when disabling
            updatedAt: serverTimestamp(),
        });
        console.log(`MFA disabled for ${userType} ${userId}.`);
    } catch (error) {
        console.error(`Error disabling MFA for ${userType} ${userId}:`, error);
        throw new Error(`Failed to disable MFA. Reason: ${(error as Error).message}`);
    }
}

/**
 * Retrieves the MFA secret for a user.
 * @param userId The ID of the user (client or freelancer).
 * @param userType 'client' or 'freelancer'.
 * @returns The MFA secret string or null if not set/found.
 */
export async function getUserMfaSecret(userId: string, userType: 'client' | 'freelancer'): Promise<string | null> {
    if (!userId) return null;
    const docRef = userType === 'client' ? getClientDocRef(userId) : getFreelancerDocRef(userId);
    try {
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data().mfaSecret ?? null) : null;
    } catch (error) {
        console.error(`Error fetching MFA secret for ${userType} ${userId}:`, error);
        throw new Error(`Failed to fetch MFA secret. Reason: ${(error as Error).message}`);
    }
}

/**
 * Checks if MFA is enabled for a user.
 * @param userId The ID of the user (client or freelancer).
 * @param userType 'client' or 'freelancer'.
 * @returns True if MFA is enabled, false otherwise.
 */
export async function isUserMfaEnabled(userId: string, userType: 'client' | 'freelancer'): Promise<boolean> {
    if (!userId) return false;
    const docRef = userType === 'client' ? getClientDocRef(userId) : getFreelancerDocRef(userId);
    try {
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data().isMfaEnabled === true) : false;
    } catch (error) {
        console.error(`Error checking MFA status for ${userType} ${userId}:`, error);
        throw new Error(`Failed to check MFA status. Reason: ${(error as Error).message}`);
    }
}

// --- Original Firestore Functions (Adapted/Kept) ---

/**
 * Adds or sets a new freelancer document in Firestore using a specific ID.
 * Initializes with default values including MFA fields.
 * @param freelancerData - Basic data (id, name, email).
 * @returns The ID of the created/updated freelancer document.
 */
export async function addFreelancer(freelancerData: Pick<Freelancer, 'id' | 'name' | 'email'>): Promise<string> {
    const { id, name, email } = freelancerData;
    if (!id) throw new Error("Freelancer ID is required to add a freelancer.");
    const freelancerDocRef = getFreelancerDocRef(id);

    try {
        await setDoc(freelancerDocRef, {
            name,
            email,
            ...defaultFreelancerData(), // Spread default values (includes MFA defaults)
            createdAt: serverTimestamp(),
        }, { merge: true });

        console.log(`Freelancer added/updated with ID: ${id}`);
        return id;
    } catch (error) {
        console.error(`Error adding/setting freelancer with ID ${id}:`, error);
        throw new Error(`Failed to add freelancer. Reason: ${(error as Error).message}`);
    }
}

/**
 * Adds or sets a new client document in Firestore using a specific ID.
 * Initializes with default values including MFA and subscription fields.
 * @param clientData - Basic data (id, name, email).
 * @returns The ID of the created/updated client document.
 */
export async function addClient(clientData: Pick<Client, 'id' | 'name' | 'email'>): Promise<string> {
    const { id, name, email } = clientData;
    if (!id) throw new Error("Client ID is required to add a client.");
    const clientDocRef = getClientDocRef(id);

    try {
        await setDoc(clientDocRef, {
            name,
            email,
            ...defaultClientData(), // Spread default values (includes MFA and subscription defaults)
            createdAt: serverTimestamp(),
        }, { merge: true });

        console.log(`Client added/updated with ID: ${id}`);
        return id;
    } catch (error) {
        console.error(`Error adding/setting client with ID ${id}:`, error);
        throw new Error(`Failed to add client. Reason: ${(error as Error).message}`);
    }
}


/**
 * Updates the skills array for a specific freelancer.
 * @param freelancerId - The ID of the freelancer document.
 * @param skills - The array of skills identified.
 */
export async function updateFreelancerSkills(freelancerId: string, skills: string[]): Promise<void> {
    if (!freelancerId) throw new Error("Freelancer ID is required.");
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    try {
        await updateDoc(freelancerDocRef, {
            skills: skills,
            updatedAt: serverTimestamp(),
        });
        console.log(`Skills updated for freelancer ${freelancerId}: ${skills.join(', ')}`);
    } catch (error) {
        console.error(`Error updating skills for freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to update freelancer skills. Reason: ${(error as Error).message}`);
    }
}

/**
 * Stores the results of an adaptive assessment and links it to the freelancer.
 * Awards onboarding badge and initial XP.
 * @param assessmentData - The assessment result data.
 * @returns The ID of the created assessment document.
 */
export async function storeAssessmentResult(assessmentData: AdaptiveAssessmentResult): Promise<string> {
    const { freelancerId, finalScore } = assessmentData;
    if (!freelancerId) throw new Error("Freelancer ID is missing from assessment data.");

    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    const newAssessmentDocRef = doc(assessmentsCollectionRef);

    const batch = writeBatch(db);

    try {
        batch.set(newAssessmentDocRef, {
            ...assessmentData,
            id: newAssessmentDocRef.id,
            completedAt: serverTimestamp()
        });

        const xpGained = 50 + Math.round(finalScore / 5);
        batch.update(freelancerDocRef, {
            assessmentResultId: newAssessmentDocRef.id,
            badges: arrayUnion('onboarding-complete'),
            xp: increment(xpGained),
            updatedAt: serverTimestamp()
        });

        await batch.commit();

        console.log(`Assessment result ${newAssessmentDocRef.id} stored, linked to freelancer ${freelancerId}. Awarded badge & ${xpGained} XP.`);
        return newAssessmentDocRef.id;

    } catch (error) {
        console.error(`Error storing assessment result for freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to store assessment result. Reason: ${(error as Error).message}`);
    }
}


/**
 * Retrieves a freelancer document by its ID.
 * @param freelancerId - The ID of the freelancer document.
 * @returns The Freelancer data or null if not found.
 */
export async function getFreelancerById(freelancerId: string): Promise<Freelancer | null> {
    if (!freelancerId) return null;
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    try {
        const docSnap = await getDoc(freelancerDocRef);
        return docSnap.exists() ? mapDocToFreelancer(docSnap) : null;
    } catch (error) {
        console.error(`Error fetching freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to fetch freelancer data. Reason: ${(error as Error).message}`);
    }
}

/**
 * Retrieves a client document by its ID.
 * @param clientId - The ID of the client document.
 * @returns The Client data or null if not found.
 */
export async function getClientById(clientId: string): Promise<Client | null> {
    if (!clientId) return null;
    const clientDocRef = getClientDocRef(clientId);
    try {
        const docSnap = await getDoc(clientDocRef);
        return docSnap.exists() ? mapDocToClient(docSnap) : null;
    } catch (error) {
        console.error(`Error fetching client ${clientId}:`, error);
        throw new Error(`Failed to fetch client data. Reason: ${(error as Error).message}`);
    }
}

/**
 * Retrieves an adaptive assessment result by its ID.
 * @param assessmentId - The ID of the assessment document.
 * @returns The AssessmentResult data or null if not found.
 */
export async function getAssessmentResultById(assessmentId: string): Promise<AdaptiveAssessmentResult | null> {
    if (!assessmentId) return null;
    const assessmentDocRef = getAssessmentDocRef(assessmentId);
    try {
        const docSnap = await getDoc(assessmentDocRef);
        return docSnap.exists() ? mapDocToAssessmentResult(docSnap) : null;
    } catch (error) {
        console.error(`Error fetching assessment result ${assessmentId}:`, error);
        throw new Error(`Failed to fetch assessment result data. Reason: ${(error as Error).message}`);
    }
}

/**
 * Updates the status and optionally the login state of a freelancer.
 * @param freelancerId - The ID of the freelancer.
 * @param status - The new status ('available', 'busy', 'offline').
 * @param isLoggedIn - Optional: The new login state. If provided, status updates automatically.
 */
export async function updateFreelancerStatus(freelancerId: string, status?: FreelancerStatus, isLoggedIn?: boolean): Promise<void> {
    if (!freelancerId) throw new Error("Freelancer ID is required.");
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    const updateData: Partial<Freelancer> & { updatedAt: Timestamp } = {
        updatedAt: serverTimestamp() as Timestamp // Explicit cast
    };

    if (isLoggedIn !== undefined) {
        updateData.isLoggedIn = isLoggedIn;
        updateData.status = isLoggedIn ? 'available' : 'offline';
    } else if (status) {
        updateData.status = status;
        if (status === 'offline') {
            updateData.isLoggedIn = false;
        }
    } else {
        console.warn("updateFreelancerStatus called without status or isLoggedIn change.");
        return;
    }

    try {
        await updateDoc(freelancerDocRef, updateData);
        console.log(`Updated status/login for freelancer ${freelancerId}. New status: ${updateData.status}, LoggedIn: ${updateData.isLoggedIn}`);
    } catch (error) {
        console.error(`Error updating status for freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to update freelancer status. Reason: ${(error as Error).message}`);
    }
}


/**
 * Retrieves available freelancers matching skills.
 * Filters by isLoggedIn=true, status='available'. Sorts by XP.
 * @param requiredSkills - Array of skills needed.
 * @param maxResults - Max number of freelancers to return.
 * @returns Array of available Freelancer objects.
 */
export async function getAvailableFreelancersBySkill(requiredSkills: string[], maxResults: number = 10): Promise<Freelancer[]> {
    if (!requiredSkills || requiredSkills.length === 0) return [];

    try {
        const q = query(
            freelancersCollectionRef,
            where('isLoggedIn', '==', true),
            where('status', '==', 'available'),
            orderBy('xp', 'desc'),
            limit(maxResults * 5) // Fetch more initially to ensure enough matches after skill filtering
        );

        const querySnapshot = await getDocs(q);
        const freelancers: Freelancer[] = [];
        querySnapshot.forEach((doc) => {
            const freelancer = mapDocToFreelancer(doc);
            const hasRequiredSkill = requiredSkills.some(skill => freelancer.skills.includes(skill));
            if (hasRequiredSkill && freelancers.length < maxResults) {
                freelancers.push(freelancer);
            }
        });

        return freelancers;
    } catch (error) {
        console.error('Error fetching available freelancers by skill:', error);
        throw new Error(`Failed to fetch available freelancers. Reason: ${(error as Error).message}`);
    }
}


/**
 * Assigns a project to a freelancer and updates both documents atomically.
 * @param freelancerId - The ID of the freelancer.
 * @param projectId - The ID of the project to assign.
 */
export async function assignProjectToFreelancer(freelancerId: string, projectId: string): Promise<void> {
    if (!freelancerId || !projectId) throw new Error("Both freelancerId and projectId are required.");
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    const projectDocRef = getProjectDocRef(projectId);
    const batch = writeBatch(db);

    try {
        batch.update(freelancerDocRef, {
            currentProjects: arrayUnion(projectId),
            status: 'busy',
            updatedAt: serverTimestamp(),
        });
        batch.update(projectDocRef, {
            assignedFreelancerId: freelancerId,
            status: 'assigned',
            updatedAt: serverTimestamp(),
        });

        await batch.commit();
        console.log(`Assigned project ${projectId} to freelancer ${freelancerId}`);
    } catch (error) {
        console.error(`Error assigning project ${projectId} to freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to assign project. Reason: ${(error as Error).message}`);
    }
}

/**
 * Removes a project assignment from a freelancer and updates statuses atomically.
 * @param freelancerId - The ID of the freelancer.
 * @param projectId - The ID of the project to unassign.
 */
export async function unassignProjectFromFreelancer(freelancerId: string, projectId: string): Promise<void> {
    if (!freelancerId || !projectId) throw new Error("Both freelancerId and projectId are required.");
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    const projectDocRef = getProjectDocRef(projectId);
    const batch = writeBatch(db);

    try {
        const freelancerSnap = await getDoc(freelancerDocRef);
        if (!freelancerSnap.exists()) {
             console.warn(`Freelancer ${freelancerId} not found during unassignment.`);
             return;
        }
        const freelancer = mapDocToFreelancer(freelancerSnap);
        const remainingProjects = freelancer.currentProjects?.filter(id => id !== projectId) ?? [];
        const newStatus: FreelancerStatus = remainingProjects.length === 0 ? 'available' : 'busy';

        batch.update(freelancerDocRef, {
            currentProjects: remainingProjects,
            status: newStatus,
            updatedAt: serverTimestamp(),
        });

        batch.update(projectDocRef, {
            assignedFreelancerId: null, // Set to null to remove the field or explicitly to null
            status: 'pending', // Revert project status or set to appropriate status
            updatedAt: serverTimestamp(),
        });

        await batch.commit();
        console.log(`Unassigned project ${projectId} from freelancer ${freelancerId}. New status: ${newStatus}`);
    } catch (error) {
        console.error(`Error unassigning project ${projectId} from freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to unassign project. Reason: ${(error as Error).message}`);
    }
}

/**
 * Fetches the details of projects assigned to a specific freelancer.
 * @param freelancerId - The ID of the freelancer.
 * @returns An array of Project objects.
 */
export async function getAssignedProjects(freelancerId: string): Promise<Project[]> {
    if (!freelancerId) return [];
    try {
        const q = query(
            projectsCollectionRef,
            where('assignedFreelancerId', '==', freelancerId),
            orderBy('updatedAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(mapDocToProject);
    } catch (error) {
        console.error(`Error fetching assigned projects for freelancer ${freelancerId}:`, error);
        throw new Error(`Failed to fetch assigned projects. Reason: ${(error as Error).message}`);
    }
}

/**
 * Fetches the details of projects created by a specific client.
 * @param clientId - The ID of the client.
 * @returns An array of Project objects.
 */
export async function getProjectsByClientId(clientId: string): Promise<Project[]> {
    if (!clientId) return [];
    try {
        const q = query(projectsCollectionRef, where('clientId', '==', clientId), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(mapDocToProject);
    } catch (error) {
        console.error(`Error fetching projects for client ${clientId}:`, error);
        throw new Error(`Failed to fetch client projects. Reason: ${(error as Error).message}`);
    }
}

/**
 * Fetches the details of a single project by its ID.
 * @param projectId - The ID of the project.
 * @returns The Project data or null if not found.
 */
export async function getProjectById(projectId: string): Promise<Project | null> {
    if (!projectId) return null;
    const projectDocRef = getProjectDocRef(projectId);
    try {
        const docSnap = await getDoc(projectDocRef);
        return docSnap.exists() ? mapDocToProject(docSnap) : null;
    } catch (error) {
        console.error(`Error fetching project ${projectId}:`, error);
        throw new Error(`Failed to fetch project data. Reason: ${(error as Error).message}`);
    }
}

/**
 * Updates the status of a specific project.
 * @param projectId - The ID of the project to update.
 * @param newStatus - The new status to set.
 */
export async function updateProjectStatus(projectId: string, newStatus: ProjectStatus): Promise<void> {
    if (!projectId) throw new Error("Project ID is required.");
    const projectDocRef = getProjectDocRef(projectId);
    try {
        await updateDoc(projectDocRef, {
            status: newStatus,
            updatedAt: serverTimestamp(),
        });
        console.log(`Updated status for project ${projectId} to ${newStatus}`);
    } catch (error) {
        console.error(`Error updating status for project ${projectId}:`, error);
        throw new Error(`Failed to update project status. Reason: ${(error as Error).message}`);
    }
}

/**
 * Updates the project document with the decomposed microtasks, storing them in a subcollection.
 * Sets the project status to 'decomposed'.
 * @param projectId The ID of the project.
 * @param microtasks An array of Microtask objects generated by the AI.
 */
export async function updateProjectMicrotasks(projectId: string, microtasks: Microtask[]): Promise<void> {
    if (!projectId) throw new Error("Project ID is required.");
    const projectDocRef = getProjectDocRef(projectId);
    const batch = writeBatch(db);

    try {
        // Delete existing microtasks first to avoid duplicates if re-decomposing
        const existingMicrotasksQuery = query(collection(projectDocRef, MICROTASKS_SUBCOLLECTION));
        const existingMicrotasksSnap = await getDocs(existingMicrotasksQuery);
        existingMicrotasksSnap.forEach(doc => batch.delete(doc.ref));

        // Add new microtasks
        microtasks.forEach((task) => {
            // Ensure task has an ID, generate if missing (though AI should provide it)
            const taskId = task.id || doc(collection(projectDocRef, MICROTASKS_SUBCOLLECTION)).id;
            const microtaskRef = getMicrotaskDocRef(projectId, taskId);
            batch.set(microtaskRef, {
                ...task,
                id: taskId, // Ensure ID is set
                status: 'pending', // Initial status
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
        });

        // Update project status
        batch.update(projectDocRef, {
            status: 'decomposed',
            updatedAt: serverTimestamp(),
        });

        await batch.commit();
        console.log(`Stored/updated ${microtasks.length} microtasks in subcollection for project ${projectId} and updated status.`);
    } catch (error) {
        console.error(`Error updating project ${projectId} with microtasks:`, error);
        await updateProjectStatus(projectId, 'pending'); // Revert status on error
        throw new Error(`Failed to store microtasks or update project status. Reason: ${(error as Error).message}`);
    }
}

/**
 * Adds a change request to a project's subcollection and updates the main project status.
 * @param projectId The ID of the project.
 * @param changeRequestData The data for the new change request.
 * @returns The generated ID of the new change request document.
 */
export async function addChangeRequestToProject(
    projectId: string,
    changeRequestData: Omit<ChangeRequest, 'id' | 'requestedAt' | 'updatedAt' | 'status'>
): Promise<string> {
    if (!projectId) throw new Error("Project ID is required.");
    const projectDocRef = getProjectDocRef(projectId);
    const newChangeRequestRef = doc(collection(projectDocRef, CHANGE_REQUESTS_SUBCOLLECTION));

    const newChangeRequest: ChangeRequest = {
        ...changeRequestData,
        id: newChangeRequestRef.id,
        status: 'pending_estimate',
        requestedAt: Timestamp.now(), // Use client-side timestamp initially
        updatedAt: Timestamp.now(),
    };

    const batch = writeBatch(db);
    try {
        batch.set(newChangeRequestRef, { ...newChangeRequest, requestedAt: serverTimestamp(), updatedAt: serverTimestamp() });

        batch.update(projectDocRef, {
            status: 'change_requested',
            updatedAt: serverTimestamp(),
        });

        await batch.commit();
        console.log(`Added change request ${newChangeRequestRef.id} to project ${projectId}`);
        return newChangeRequestRef.id;
    } catch (error) {
        console.error(`Error adding change request to project ${projectId}:`, error);
        throw new Error(`Failed to add change request. Reason: ${(error as Error).message}`);
    }
}

/**
 * Updates a specific change request document within a project's subcollection.
 * Optionally updates the main project status based on the change request update.
 * @param projectId The ID of the project.
 * @param changeRequestId The ID of the change request document to update.
 * @param updates An object containing the fields to update in the change request.
 */
export async function updateChangeRequestInProject(
    projectId: string,
    changeRequestId: string,
    updates: Partial<Omit<ChangeRequest, 'id' | 'requestedBy' | 'requestedAt'>>
): Promise<void> {
    if (!projectId || !changeRequestId) throw new Error("Project ID and Change Request ID are required.");
    const projectDocRef = getProjectDocRef(projectId);
    const changeRequestRef = getChangeRequestDocRef(projectId, changeRequestId);
    const batch = writeBatch(db);

    try {
        const changeUpdateData: Partial<ChangeRequest> & { updatedAt: Timestamp } = {
            ...updates,
            updatedAt: serverTimestamp() as Timestamp, // Explicit cast
        };
        batch.update(changeRequestRef, changeUpdateData);

        let newProjectStatus: ProjectStatus | undefined = undefined;
        if ('status' in updates) {
            const newCrStatus = updates.status;
            if (newCrStatus === 'approved') {
                newProjectStatus = 'change_approved';
            } else if (newCrStatus === 'rejected' || newCrStatus === 'cancelled') {
                // Check if any *other* change requests are still pending
                const crCollectionRef = collection(projectDocRef, CHANGE_REQUESTS_SUBCOLLECTION);
                const q = query(crCollectionRef, where('status', 'in', ['pending_estimate', 'pending_approval']));
                const pendingRequestsSnap = await getDocs(q);

                // If the only pending request was the one just rejected/cancelled, revert project status
                 if (pendingRequestsSnap.docs.filter(doc => doc.id !== changeRequestId).length === 0) {
                     const projectSnap = await getDoc(projectDocRef);
                     if (projectSnap.exists()) {
                         const currentProjectStatus = projectSnap.data().status;
                         // Only revert if it was in a change-related state
                         if (currentProjectStatus === 'change_requested' || currentProjectStatus === 'change_approved') {
                             // Decide what state to revert to (e.g., 'in_progress' or original status before change)
                             newProjectStatus = 'in_progress'; // Or fetch original status if tracked
                         }
                     }
                 }
            }
        }

        // Update project status if determined, otherwise just update its timestamp
        if (newProjectStatus) {
            batch.update(projectDocRef, {
                status: newProjectStatus,
                updatedAt: serverTimestamp(),
            });
            console.log(`Project ${projectId} status updated to ${newProjectStatus}.`);
        } else {
            batch.update(projectDocRef, { updatedAt: serverTimestamp() });
        }


        await batch.commit();
        console.log(`Updated change request ${changeRequestId} in project ${projectId}.`);
    } catch (error) {
        console.error(`Error updating change request ${changeRequestId} in project ${projectId}:`, error);
        throw new Error(`Failed to update change request. Reason: ${(error as Error).message}`);
    }
}

// --- Gamification Functions ---

/**
 * Awards experience points (XP) to a freelancer. Handles non-existent freelancers gracefully.
 * @param freelancerId - The ID of the freelancer.
 * @param amount - The amount of XP to award (positive or negative).
 */
export async function awardXp(freelancerId: string, amount: number): Promise<void> {
    if (!freelancerId || amount === 0) return;
    const freelancerDocRef = getFreelancerDocRef(freelancerId);

    try {
        await updateDoc(freelancerDocRef, {
            xp: increment(amount),
            updatedAt: serverTimestamp(),
        });
        console.log(`Awarded ${amount} XP to freelancer ${freelancerId}.`);
    } catch (error: any) {
         if (error.code === 'not-found') {
             console.warn(`Cannot award XP: Freelancer ${freelancerId} not found.`);
         } else {
            console.error(`Error awarding XP to freelancer ${freelancerId}:`, error);
            // Optionally re-throw or handle differently
         }
    }
}

/**
 * Awards a badge to a freelancer if they haven't already earned it.
 * Handles non-existent freelancers and invalid badge arrays gracefully.
 * @param freelancerId - The ID of the freelancer.
 * @param badgeId - The unique ID of the badge to award.
 */
export async function awardBadge(freelancerId: string, badgeId: string): Promise<void> {
    if (!freelancerId || !badgeId) return;
    const freelancerDocRef = getFreelancerDocRef(freelancerId);

    try {
        const docSnap = await getDoc(freelancerDocRef);
         if (!docSnap.exists()) {
            console.warn(`Cannot award badge: Freelancer ${freelancerId} not found.`);
            return;
        }

        const freelancer = mapDocToFreelancer(docSnap);

        // Ensure badges array exists before checking includes
        if (freelancer.badges?.includes(badgeId)) {
            console.log(`Freelancer ${freelancerId} already has badge '${badgeId}'.`);
            return; // Already has the badge
        }

        await updateDoc(freelancerDocRef, {
            badges: arrayUnion(badgeId), // Add badge to the array
            xp: increment(50), // Award XP for earning a badge
            updatedAt: serverTimestamp(),
        });
        console.log(`Awarded badge '${badgeId}' and 50 XP to freelancer ${freelancerId}`);

    } catch (error) {
        console.error(`Error awarding badge '${badgeId}' to freelancer ${freelancerId}:`, error);
        // Optionally handle specific errors differently
    }
}

/**
 * Retrieves the top freelancers based on their XP score.
 * @param count - The maximum number of freelancers to retrieve.
 * @returns An array of Freelancer objects sorted by XP descending.
 */
export async function getTopFreelancers(count: number = 10): Promise<Freelancer[]> {
  if (count <= 0) return [];
  try {
    const q = query(freelancersCollectionRef, orderBy('xp', 'desc'), limit(count));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(mapDocToFreelancer);
  } catch (error) {
    console.error('Error fetching top freelancers:', error);
    throw new Error(`Failed to fetch leaderboard data. Reason: ${(error as Error).message}`);
  }
}

// Ensure all functions handle potential missing fields gracefully.

// --- Skill Test Scoring Update ---

/**
 * Updates the test score for a specific skill for a freelancer.
 * Uses set with merge:true to handle cases where testScores might not exist yet.
 * @param freelancerId - The ID of the freelancer.
 * @param skill - The skill being scored.
 * @param score - The score achieved (0-100).
 */
export async function updateFreelancerTestScore(freelancerId: string, skill: string, score: number): Promise<void> {
    if (!freelancerId || !skill) throw new Error("Freelancer ID and skill are required.");
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    try {
        await setDoc(freelancerDocRef, {
            testScores: {
                [skill]: score, // Use computed property name
            },
            updatedAt: serverTimestamp(),
        }, { merge: true }); // Use merge:true to only update the specified skill score
        console.log(`Updated test score for skill "${skill}" to ${score} for freelancer ${freelancerId}.`);
    } catch (error) {
        console.error(`Error updating test score for freelancer ${freelancerId}, skill ${skill}:`, error);
        throw new Error(`Failed to update freelancer test score. Reason: ${(error as Error).message}`);
    }
}

// --- Stripe Related Functions ---

/**
 * Updates the client's subscription status and Stripe subscription ID in Firestore.
 * @param clientId - The ID of the client.
 * @param status - The Stripe subscription status.
 * @param subscriptionId - The Stripe subscription ID.
 */
export async function updateClientSubscriptionStatus(
    clientId: string,
    status: Stripe.Subscription.Status,
    subscriptionId: string | null
): Promise<void> {
    if (!clientId) throw new Error("Client ID is required.");
    const clientDocRef = getClientDocRef(clientId);
    try {
        await updateDoc(clientDocRef, {
            subscriptionStatus: status,
            stripeSubscriptionId: subscriptionId,
            updatedAt: serverTimestamp(),
        });
        console.log(`Updated client ${clientId} subscription status to ${status} (ID: ${subscriptionId})`);
    } catch (error) {
        console.error(`Error updating subscription status for client ${clientId}:`, error);
        throw new Error(`Failed to update client subscription status. Reason: ${(error as Error).message}`);
    }
}

/**
 * Updates the payment status of a specific project.
 * @param projectId - The ID of the project to update.
 * @param paymentStatus - The new payment status ('paid', 'payment_failed', 'pending').
 */
export async function updateProjectPaymentStatus(
    projectId: string,
    paymentStatus: 'paid' | 'payment_failed' | 'pending'
): Promise<void> {
    if (!projectId) throw new Error("Project ID is required.");
    const projectDocRef = getProjectDocRef(projectId);
    try {
         // Optionally, update the main project status based on payment
         let projectUpdate: Partial<Project> & { updatedAt: Timestamp } = {
             paymentStatus: paymentStatus,
             updatedAt: serverTimestamp() as Timestamp, // Explicit cast
         };
          if (paymentStatus === 'paid') {
              projectUpdate.status = 'pending'; // Or 'decomposing' if you start that immediately
          } else if (paymentStatus === 'payment_failed') {
              // Decide how to handle failed payment status - keep pending? set to error?
              projectUpdate.status = 'pending'; // Keep pending until payment resolved
          }

        await updateDoc(projectDocRef, projectUpdate);
        console.log(`Updated payment status for project ${projectId} to ${paymentStatus}`);
    } catch (error) {
        console.error(`Error updating payment status for project ${projectId}:`, error);
        throw new Error(`Failed to update project payment status. Reason: ${(error as Error).message}`);
    }
}

/**
 * Fetches the assessment status for a freelancer.
 * @param freelancerId - The ID of the freelancer.
 * @returns 'completed', 'in-progress', or 'not-started'.
 */
export async function getFreelancerAssessmentStatus(freelancerId: string): Promise<'completed' | 'in-progress' | 'not-started'> {
  if (!freelancerId) return 'not-started';
  try {
    const freelancerDocRef = getFreelancerDocRef(freelancerId);
    const docSnap = await getDoc(freelancerDocRef);

    if (!docSnap.exists()) {
      console.warn(`Freelancer ${freelancerId} not found when checking assessment status.`);
      return 'not-started';
    }

    const freelancer = mapDocToFreelancer(docSnap);
    if (freelancer.assessmentResultId) {
      // Optional: You could further check if the assessment itself exists and is valid
      // const assessmentSnap = await getDoc(getAssessmentDocRef(freelancer.assessmentResultId));
      // return assessmentSnap.exists() ? 'completed' : 'in-progress'; // Or handle error
      return 'completed';
    } else {
      // Check if they've started the process but haven't finished
      // This logic might need refinement based on how you track 'in-progress'
      // For now, assume if no result ID, it's not started or was abandoned
      return 'not-started';
    }
  } catch (error) {
    console.error(`Error fetching assessment status for freelancer ${freelancerId}:`, error);
    // Decide default behavior on error, e.g., assume not started
    return 'not-started';
  }
}
