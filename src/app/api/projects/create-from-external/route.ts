
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createProjectFromExternal } from '@/services/firestore';
import { getClientById } from '@/services/firestore'; // To validate client ID

// Define the expected request body schema using Zod
const CreateProjectPayloadSchema = z.object({
  externalProjectId: z.string().optional().describe('Optional: ID of the project/task from the external system (e.g., Monday.com task ID).'),
  projectName: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(100),
  projectBrief: z.string().min(20, { message: 'Project brief must be at least 20 characters.' }).max(5000),
  requiredSkills: z.array(z.string()).optional().describe('Optional: List of initially identified skills.'),
  hireverseClientId: z.string().min(1, { message: 'Hireverse Client ID is required.' }),
});

// Retrieve the API key from environment variables
// IMPORTANT: This key must be set in your .env file or deployment environment
const HIREVERSE_INGESTION_API_KEY = process.env.HIREVERSE_INGESTION_API_KEY;

export async function POST(request: NextRequest) {
  // 1. Authenticate the request
  const apiKey = request.headers.get('X-API-Key');
  if (!HIREVERSE_INGESTION_API_KEY) {
    return NextResponse.json({ error: 'API endpoint not configured.' }, { status: 503 }); // Service Unavailable
  }
  if (!apiKey || apiKey !== HIREVERSE_INGESTION_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing API Key.' }, { status: 401 });
  }

  // 2. Parse and validate the request body
  let payload;
  try {
    const rawPayload = await request.json();
    payload = CreateProjectPayloadSchema.parse(rawPayload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload.', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to parse request body.' }, { status: 400 });
  }

  try {
    // 3. Verify the hireverseClientId exists
    const clientExists = await getClientById(payload.hireverseClientId);
    if (!clientExists) {
      return NextResponse.json({ error: `Client with ID '${payload.hireverseClientId}' not found in Hireverse.` }, { status: 404 });
    }

    // 4. Create the project in Firestore
    const newProjectId = await createProjectFromExternal({
      name: payload.projectName,
      brief: payload.projectBrief,
      requiredSkills: payload.requiredSkills ?? [], // Default to empty array if not provided
      clientId: payload.hireverseClientId,
      externalProjectId: payload.externalProjectId,
      // Initial status will be set by createProjectFromExternal
    });

    // 5. Respond with success
    return NextResponse.json(
      {
        hireverseProjectId: newProjectId,
        message: 'Project created successfully in Hireverse and is pending processing.',
      },
      { status: 201 } // 201 Created
    );

  } catch (error: any) {
    // Differentiate between known errors (e.g., client not found handled above) and unexpected server errors
    return NextResponse.json({ error: `Internal Server Error: ${error.message || 'Could not create project.'}` }, { status: 500 });
  }
}
