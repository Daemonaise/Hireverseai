import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getWorkspace } from './workspaces';
import { listConnections } from './connections';
import { listNotes } from './notes';
import { listBookmarks } from './bookmarks';
import { getAssignedProjects } from '@/services/firestore';

export async function generateAIContext(
  freelancerId: string,
  workspaceId: string
): Promise<string> {
  const workspace = await getWorkspace(freelancerId, workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const connections = await listConnections(freelancerId, workspaceId);
  const notes = await listNotes(freelancerId, workspaceId);
  const bookmarks = await listBookmarks(freelancerId, workspaceId);
  const projects = await getAssignedProjects(freelancerId);

  let md = `# Workspace: ${workspace.clientName}\n\n`;
  md += `## Engagement\n`;
  md += `- Type: ${workspace.engagementType}\n`;
  md += `- Status: ${workspace.status}\n`;
  md += `- Created: ${workspace.createdAt.toDate().toISOString()}\n\n`;

  md += `## Connected Systems\n`;
  if (connections.length === 0) {
    md += `- No systems connected\n`;
  } else {
    for (const c of connections) {
      md += `- ${c.label} (${c.provider}): ${c.status} — connected since ${c.createdAt.toDate().toISOString()}\n`;
    }
  }
  md += `\n`;

  md += `## Active Hireverse Projects\n`;
  const activeProjects = projects.filter(
    (p) => p.status !== 'completed' && p.status !== 'cancelled'
  );
  if (activeProjects.length === 0) {
    md += `- No active projects\n`;
  } else {
    for (const p of activeProjects) {
      md += `- ${p.name}: ${p.status}, skills: ${p.requiredSkills.join(', ')}`;
      if (p.estimatedDeliveryDate) {
        md += `, due: ${p.estimatedDeliveryDate.toDate().toISOString()}`;
      }
      md += `\n`;
    }
  }
  md += `\n`;

  md += `## Notes Summary\n`;
  if (notes.length === 0) {
    md += `- No notes\n`;
  } else {
    for (const n of notes) {
      md += `- ${n.title}: ${n.content.substring(0, 200)}${n.content.length > 200 ? '...' : ''}\n`;
    }
  }
  md += `\n`;

  md += `## Bookmarks\n`;
  if (bookmarks.length === 0) {
    md += `- No bookmarks\n`;
  } else {
    for (const b of bookmarks) {
      md += `- [${b.title}](${b.url}): ${b.description}\n`;
    }
  }
  md += `\n`;

  md += `## Workspace Rules\n`;
  md += `- Data from this workspace must NEVER be shared with other workspaces\n`;
  md += `- This freelancer's role: ${workspace.engagementType}\n`;
  md += `- Only reference data within this workspace context\n`;

  // Store in Firestore
  const contextRef = doc(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'aiContext', 'current'
  );
  await setDoc(contextRef, { markdown: md, updatedAt: serverTimestamp() });

  return md;
}

export async function getAIContext(
  freelancerId: string,
  workspaceId: string
): Promise<string | null> {
  const contextRef = doc(
    db, 'freelancers', freelancerId, 'workspaces', workspaceId, 'aiContext', 'current'
  );
  const snap = await getDoc(contextRef);
  if (!snap.exists()) return null;
  return snap.data().markdown as string;
}
