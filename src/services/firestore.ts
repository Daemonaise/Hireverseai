'use server';

import {
  collection, doc, serverTimestamp, getDoc, setDoc, updateDoc,
  query, where, getDocs, orderBy, limit, writeBatch, increment, arrayUnion, collectionGroup
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Firestore, FieldValue, Timestamp } from 'firebase/firestore';
import type { Freelancer, FreelancerStatus } from '@/types/freelancer';
import type { Project, ProjectStatus, ChangeRequest, Microtask } from '@/types/project';
import type { AdaptiveAssessmentResult } from '@/types/assessment';
import type { Client } from '@/types/client';
import { authenticator } from 'otplib';
import type Stripe from 'stripe'; 

// --- Setup and Helpers ---
const database = db as Firestore;

const freelancersRef = collection(database, 'freelancers');
const projectsRef = collection(database, 'projects');
const assessmentsRef = collection(database, 'assessments');
const clientsRef = collection(database, 'clients');

const now = (): Timestamp => serverTimestamp() as Timestamp;

const getDocRef = (collectionName: string, id: string) => doc(database, collectionName, id);

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

// --- Core Firestore Actions ---
export async function addFreelancer({ id, name, email }: Pick<Freelancer, 'id' | 'name' | 'email'>) {
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
  }, { merge: true });
}

export async function addClient({ id, name, email }: Pick<Client, 'id' | 'name' | 'email'>) {
  await setDoc(getDocRef('clients', id), {
    name,
    email,
    mfaSecret: null,
    isMfaEnabled: false,
    subscriptionStatus: 'inactive',
    stripeSubscriptionId: null,
    createdAt: now(),
    updatedAt: now(),
  }, { merge: true });
}

export async function updateFreelancerSkills(freelancerId: string, skills: string[]) {
  await updateDoc(getDocRef('freelancers', freelancerId), {
    skills,
    updatedAt: now(),
  });
}

export async function updateFreelancerStatus(freelancerId: string, status?: FreelancerStatus, isLoggedIn?: boolean) {
  const updateData: Partial<Freelancer> & { updatedAt: Timestamp } = { updatedAt: now() };
  if (isLoggedIn !== undefined) {
    updateData.isLoggedIn = isLoggedIn;
    updateData.status = isLoggedIn ? 'available' : 'offline';
  } else if (status) {
    updateData.status = status;
    if (status === 'offline') updateData.isLoggedIn = false;
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

export async function storeAssessmentResult(assessment: AdaptiveAssessmentResult) {
  const assessmentRef = doc(assessmentsRef);
  const batch = writeBatch(database);

  batch.set(assessmentRef, { ...assessment, id: assessmentRef.id, completedAt: now() });
  batch.update(getDocRef('freelancers', assessment.freelancerId), {
    assessmentResultId: assessmentRef.id,
    badges: arrayUnion('onboarding-complete'),
    xp: increment(50 + Math.round(assessment.finalScore / 5)),
    updatedAt: now(),
  });

  await batch.commit();
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
  const q = query(freelancersRef, where('isLoggedIn', '==', true), where('status', '==', 'available'), orderBy('xp', 'desc'), limit(max * 5));
  const snap = await getDocs(q);
  const freelancers = snap.docs.map(d => ({ id: d.id, ...d.data() } as Freelancer));
  return freelancers.filter(f => skills.some(skill => f.skills.includes(skill))).slice(0, max);
}

export async function assignProjectToFreelancer(freelancerId: string, projectId: string) {
  const batch = writeBatch(database);
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

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  await updateDoc(getDocRef('projects', projectId), {
    status,
    updatedAt: now(),
  });
}

export async function updateProjectMicrotasks(projectId: string, microtasks: Microtask[]) {
  const projectRef = getDocRef('projects', projectId);
  const batch = writeBatch(database);

  // Delete existing microtasks
  const tasksSnap = await getDocs(collection(projectRef, 'microtasks'));
  tasksSnap.forEach((docSnap) => batch.delete(docSnap.ref));

  // Add new microtasks (preserving createdAt from Microtask object)
  microtasks.forEach(task => {
    const microtaskRef = doc(collection(projectRef, 'microtasks'), task.id);
    batch.set(microtaskRef, {
      ...task,
      createdAt: task.createdAt, // use existing Timestamp
      updatedAt: now(),          // set updatedAt to server time
    });
  });

  // Update project status
  batch.update(projectRef, {
    status: 'decomposed',
    updatedAt: now(),
  });

  await batch.commit();
}

export async function updateClientSubscriptionStatus(clientId: string, status: Stripe.Subscription.Status, subscriptionId: string | null) {
  await updateDoc(getDocRef('clients', clientId), {
    subscriptionStatus: status,
    stripeSubscriptionId: subscriptionId,
    updatedAt: now(),
  });
}

export async function updateProjectPaymentStatus(projectId: string, paymentStatus: 'paid' | 'payment_failed' | 'pending') {
  const statusMap: Record<string, ProjectStatus> = {
    paid: 'pending',
    payment_failed: 'pending',
    pending: 'pending',
  };
  await updateDoc(getDocRef('projects', projectId), {
    paymentStatus,
    status: statusMap[paymentStatus],
    updatedAt: now(),
  });
}
