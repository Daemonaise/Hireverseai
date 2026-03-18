export interface Review {
  id: string;
  projectId: string;
  freelancerId: string;
  clientId: string;
  clientName: string;
  projectTitle: string;
  rating: number;
  categories: {
    quality: number;
    communication: number;
    timeliness: number;
    expertise: number;
  };
  comment: string;
  freelancerReply?: string;
  freelancerRepliedAt?: any;
  isVerified: boolean;
  createdAt: any;
}

export interface ReviewPrompt {
  projectId: string;
  projectTitle: string;
  freelancerId: string;
  freelancerName: string;
  status: 'pending' | 'completed' | 'dismissed';
  createdAt: any;
}
