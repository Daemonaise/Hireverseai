/**
 * Represents the structure of a Badge definition.
 * This might be stored in a separate 'badges' collection in Firestore
 * or defined statically in the application.
 */
export interface Badge {
    id: string; // Unique identifier for the badge (e.g., 'top-scorer-react', 'helpful-mentor')
    name: string; // Display name of the badge (e.g., "React Top Scorer", "Helpful Mentor")
    description: string; // Description of how the badge is earned
    iconUrl?: string; // URL to an icon representing the badge (optional)
}

// Example static badge definitions (could also be fetched from Firestore)
export const BADGES: { [key: string]: Badge } = {
    'onboarding-complete': {
        id: 'onboarding-complete',
        name: 'Onboarding Complete',
        description: 'Successfully completed the initial signup and skill test.',
        // iconUrl: '/icons/onboarding-badge.svg' // Example path
    },
    'first-task-success': {
        id: 'first-task-success',
        name: 'First Task Success',
        description: 'Successfully completed your first project task.',
        // iconUrl: '/icons/first-task-badge.svg'
    },
    'top-scorer-react': {
        id: 'top-scorer-react',
        name: 'React Top Scorer',
        description: 'Achieved a high score on the React skill test.',
        // iconUrl: '/icons/react-badge.svg'
    },
     'helpful-mentor': {
        id: 'helpful-mentor',
        name: 'Helpful Mentor',
        description: 'Provided valuable assistance or mentorship to other freelancers.',
        // iconUrl: '/icons/mentor-badge.svg'
    },
     'community-contributor': {
        id: 'community-contributor',
        name: 'Community Contributor',
        description: 'Made significant contributions to the community forum.',
        // iconUrl: '/icons/community-badge.svg'
    },
};
