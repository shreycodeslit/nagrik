import type { Analysis } from './issues';

// Sample photos with the photo reader's answers saved alongside, so the demo works with no AI quota at all.
export interface Sample { file: string; label: string; lat: number; lng: number; locality: string; analysis: Analysis }

export const SAMPLES: Sample[] = [
  {
    file: '/samples/garbage.jpg', label: 'Overflowing bins', lat: 28.4672, lng: 77.0641, locality: 'Sector 29, Gurugram',
    analysis: { issue: 'garbage', confidence: 0.93, severity: 3, title: 'Overflowing bins beside the market road', description: 'Community bins are full and garbage has spilled onto the road edge. It is attracting stray animals and blocks part of the lane.', descriptionHi: 'सामुदायिक कूड़ेदान भरे हुए हैं और कूड़ा सड़क के किनारे फैल गया है। इससे आवारा पशु आ रहे हैं और रास्ता आंशिक रूप से बंद है।', roadType: 'internal', hazards: ['stray animals', 'smell near shops'], privacyBoxes: [] },
  },
  {
    file: '/samples/pothole.jpg', label: 'Pothole', lat: 28.4956, lng: 77.0889, locality: 'DLF Phase 3, Gurugram',
    analysis: { issue: 'pothole', confidence: 0.95, severity: 4, title: 'Deep pothole in the left lane', description: 'A pothole roughly a metre wide sits in the left lane. Two-wheelers swerve into traffic to avoid it.', descriptionHi: 'बाईं लेन में लगभग एक मीटर चौड़ा गड्ढा है। दोपहिया वाहन इससे बचने के लिए ट्रैफ़िक में मुड़ जाते हैं।', roadType: 'main', hazards: ['two-wheelers swerving'], privacyBoxes: [] },
  },
  {
    file: '/samples/waterlogging.jpg', label: 'Waterlogging', lat: 28.4823, lng: 77.0782, locality: 'Near IFFCO Chowk, Gurugram',
    analysis: { issue: 'waterlogging', confidence: 0.9, severity: 4, title: 'Water standing across the road after rain', description: 'Standing water covers the full width of the road. Drain inlets along the kerb appear blocked.', descriptionHi: 'सड़क की पूरी चौड़ाई पर पानी भरा है। किनारे की नालियां जाम दिखती हैं।', roadType: 'main', hazards: ['vehicles stalling', 'hidden potholes'], privacyBoxes: [] },
  },
];
