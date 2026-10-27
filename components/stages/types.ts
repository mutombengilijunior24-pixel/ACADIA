// Forme JSON d'un dossier MNJ Stage Connect côté navigateur (dates en chaînes ISO).

import type { StagePaymentState, StageStatus, StageType } from "@/lib/core/stages/catalog";
import type { MomoAccount } from "@/lib/core/stages/momo";

export interface AttendanceJson {
  day: string;
  arrivalAt: string;
  departureAt: string | null;
  activities: string | null;
  tutorConfirmedAt: string | null;
}

export interface ApplicationJson {
  id: string;
  type: StageType;
  status: StageStatus;
  lastName: string;
  postName: string;
  firstName: string;
  phone: string;
  email: string;
  university: string;
  institutionId: string | null;
  faculty: string;
  facultyName: string | null;
  department: string;
  level: string;
  studentNumber: string | null;
  graduationYear: number | null;
  skills: string[];
  objectives: string;
  preferredCompany: string | null;
  preferredCity: string | null;
  startMonth: string | null;
  paymentStatus: StagePaymentState;
  paymentMethod: string | null;
  /** Options choisies ou réglées : recommandation (17 $), assurance (10 $). */
  packOptions: string[];
  /** Paiement Mobile Money déclaré par l'étudiant (à vérifier par l'équipe). */
  payAccount: string | null;
  payTransactionId: string | null;
  paySenderPhone: string | null;
  payDeclaredAt: string | null;
  paidAt: string | null;
  packAcceptedAt: string | null;
  adminNotes: string | null;
  assignedCompany: string | null;
  documentsReceived: string[];
  companyAddress: string | null;
  tutorName: string | null;
  tutorRole: string | null;
  tutorPhone: string | null;
  tutorEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface PaymentChannelsJson {
  reference: string;
  online: boolean;
  momo: MomoAccount[];
}

export interface DossierJson extends ApplicationJson {
  attendance: AttendanceJson[];
  today: string;
  payment: PaymentChannelsJson;
}
