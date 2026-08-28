"use client";

// ============================================================
// ACADIA — CONTEXTE DE SUPERVISION (P16)
//
// Contrairement à ResearchContext (localStorage, mono-navigateur),
// toutes les données ici sont cross-utilisateur (étudiant ↔
// directeur) : elles ne peuvent vivre que côté serveur (voir
// ACADIA_P16_ARCHITECTURE.md). Ce contexte est une fine couche
// d'appels à /api/supervision/* — aucune donnée n'est mise en
// cache dans localStorage ici.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SupervisorProfile,
  SupervisionCanevas,
  SupervisorInvitation,
  Submission,
  InboxMessage,
  Notification as SupervisionNotification,
  FeedbackSectionEntry,
  CorrectionStatus,
  SubmissionStatus,
  WorkType,
  CanevasStep,
  HypothesisCountRule,
} from "@/lib/core/supervision/SupervisionTypes";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";

interface StudentSupervisorInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile: SupervisorProfile | null;
  researchId?: string;
}

interface StudentListEntry {
  assignmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  researchId?: string;
  latestSubmission: {
    id: string;
    researchId: string;
    researchTitle: string;
    version: number;
    status: SubmissionStatus;
    submittedAt: string;
  } | null;
  submissionCount: number;
}

interface SubmissionSummary {
  id: string;
  researchId: string;
  studentId: string;
  supervisorId: string;
  version: number;
  submittedAt: string;
  status: SubmissionStatus;
  studentMessage?: string;
  reviewedAt?: string;
  feedbackId?: string;
  previousSubmissionId?: string;
  researchTitle: string;
}

interface SupervisionContextValue {
  notifications: SupervisionNotification[];
  unreadNotificationCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

  messages: InboxMessage[];
  refreshMessages: () => Promise<void>;
  markMessageRead: (id: string) => Promise<void>;

  becomeSupervisor: () => Promise<void>;

  getProfile: () => Promise<SupervisorProfile | null>;
  saveProfile: (patch: Partial<SupervisorProfile>) => Promise<SupervisorProfile>;

  listCanevas: () => Promise<SupervisionCanevas[]>;
  createCanevas: (input: {
    academicYear: string;
    faculty?: string;
    department?: string;
    workTypes: WorkType[];
    steps: Omit<CanevasStep, "id" | "status">[];
    hypothesisRules?: HypothesisCountRule[];
  }) => Promise<SupervisionCanevas>;
  updateCanevas: (id: string, patch: Partial<SupervisionCanevas>) => Promise<SupervisionCanevas | null>;

  listInvitations: () => Promise<SupervisorInvitation[]>;
  createInvitation: (input?: { studentEmail?: string; researchId?: string }) => Promise<SupervisorInvitation>;
  acceptInvitation: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;

  listMyStudents: () => Promise<StudentListEntry[]>;
  getMySupervisor: () => Promise<StudentSupervisorInfo | null>;

  listSubmissions: () => Promise<SubmissionSummary[]>;
  submitVersion: (input: {
    researchId: string;
    project: ResearchProject;
    instrument?: InstrumentRecord;
    theoreticalFramework?: TheoreticalFrameworkEntry[];
    studentMessage?: string;
  }) => Promise<
    | { ok: true; submission: SubmissionSummary; email: { status: string } }
    | { ok: false; error: string }
  >;
  getSubmissionDetail: (
    id: string
  ) => Promise<{
    submission: Submission;
    corrections: unknown[];
    feedback: unknown[];
    student: { firstName: string; lastName: string; email: string } | null;
  } | null>;
  updateSubmissionStatus: (id: string, status: SubmissionStatus) => Promise<void>;
  getBrief: (submissionId: string) => Promise<unknown>;
  getComparison: (submissionId: string) => Promise<unknown>;

  sendFeedback: (input: {
    submissionId: string;
    globalEvaluation: string;
    sections: FeedbackSectionEntry[];
  }) => Promise<{ feedbackText: string; email: { status: string } }>;

  updateCorrectionStatus: (id: string, status: CorrectionStatus) => Promise<void>;
  addCorrectionDiscussion: (id: string, body: string) => Promise<void>;
}

const SupervisionContext = createContext<SupervisionContextValue | undefined>(undefined);

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
  return data as T;
}

export function SupervisionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SupervisionNotification[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      const data = await jsonFetch<{ notifications: SupervisionNotification[] }>("/api/supervision/notifications");
      setNotifications(data.notifications);
    } catch {
      setNotifications([]);
    }
  }, [user]);

  const refreshMessages = useCallback(async () => {
    if (!user) {
      setMessages([]);
      return;
    }
    try {
      const data = await jsonFetch<{ messages: InboxMessage[] }>("/api/supervision/messages");
      setMessages(data.messages);
    } catch {
      setMessages([]);
    }
  }, [user]);

  useEffect(() => {
    // Synchronisation initiale avec le serveur au montage / changement
    // d'utilisateur — requête réseau asynchrone, même justification
    // que l'hydratation de AuthContext/ResearchContext.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshNotifications();
    refreshMessages();
  }, [refreshNotifications, refreshMessages]);

  const markNotificationRead = useCallback(
    async (id: string) => {
      await jsonFetch("/api/supervision/notifications", { method: "PATCH", body: JSON.stringify({ id }) });
      await refreshNotifications();
    },
    [refreshNotifications]
  );

  const markMessageRead = useCallback(
    async (id: string) => {
      await jsonFetch(`/api/supervision/messages/${id}/read`, { method: "PATCH" });
      await refreshMessages();
    },
    [refreshMessages]
  );

  const becomeSupervisor = useCallback(async () => {
    await jsonFetch("/api/auth/become-supervisor", { method: "POST" });
  }, []);

  const getProfile = useCallback(async () => {
    const data = await jsonFetch<{ profile: SupervisorProfile | null }>("/api/supervision/profile");
    return data.profile;
  }, []);

  const saveProfile = useCallback(async (patch: Partial<SupervisorProfile>) => {
    const data = await jsonFetch<{ profile: SupervisorProfile }>("/api/supervision/profile", {
      method: "POST",
      body: JSON.stringify(patch),
    });
    return data.profile;
  }, []);

  const listCanevas = useCallback(async () => {
    const data = await jsonFetch<{ canevas: SupervisionCanevas[] }>("/api/supervision/canevas");
    return data.canevas;
  }, []);

  const createCanevasFn = useCallback(
    async (input: {
      academicYear: string;
      faculty?: string;
      department?: string;
      workTypes: WorkType[];
      steps: Omit<CanevasStep, "id" | "status">[];
      hypothesisRules?: HypothesisCountRule[];
    }) => {
      const data = await jsonFetch<{ canevas: SupervisionCanevas }>("/api/supervision/canevas", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data.canevas;
    },
    []
  );

  const updateCanevasFn = useCallback(async (id: string, patch: Partial<SupervisionCanevas>) => {
    try {
      const data = await jsonFetch<{ canevas: SupervisionCanevas }>(`/api/supervision/canevas/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return data.canevas;
    } catch {
      return null;
    }
  }, []);

  const listInvitations = useCallback(async () => {
    const data = await jsonFetch<{ invitations: SupervisorInvitation[] }>("/api/supervision/invitations");
    return data.invitations;
  }, []);

  const createInvitationFn = useCallback(async (input?: { studentEmail?: string; researchId?: string }) => {
    const data = await jsonFetch<{ invitation: SupervisorInvitation }>("/api/supervision/invitations", {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
    return data.invitation;
  }, []);

  const acceptInvitation = useCallback(async (code: string) => {
    try {
      await jsonFetch("/api/supervision/invitations/accept", { method: "POST", body: JSON.stringify({ code }) });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Impossible d'accepter cette invitation." };
    }
  }, []);

  const listMyStudents = useCallback(async () => {
    const data = await jsonFetch<{ students: StudentListEntry[] }>("/api/supervision/students");
    return data.students;
  }, []);

  const getMySupervisor = useCallback(async () => {
    const data = await jsonFetch<{ supervisor: StudentSupervisorInfo | null }>("/api/supervision/my-supervisor");
    return data.supervisor;
  }, []);

  const listSubmissions = useCallback(async () => {
    const data = await jsonFetch<{ submissions: SubmissionSummary[] }>("/api/supervision/submissions");
    return data.submissions;
  }, []);

  const submitVersion = useCallback(
    async (input: {
      researchId: string;
      project: ResearchProject;
      instrument?: InstrumentRecord;
      theoreticalFramework?: TheoreticalFrameworkEntry[];
      studentMessage?: string;
    }) => {
      try {
        const data = await jsonFetch<{ submission: SubmissionSummary; email: { status: string } }>("/api/supervision/submissions", {
          method: "POST",
          body: JSON.stringify(input),
        });
        return { ok: true as const, submission: data.submission, email: data.email };
      } catch (e) {
        return { ok: false as const, error: e instanceof Error ? e.message : "Soumission impossible." };
      }
    },
    []
  );

  const getSubmissionDetail = useCallback(async (id: string) => {
    try {
      return await jsonFetch<{
        submission: Submission;
        corrections: unknown[];
        feedback: unknown[];
        student: { firstName: string; lastName: string; email: string } | null;
      }>(`/api/supervision/submissions/${id}`);
    } catch {
      return null;
    }
  }, []);

  const updateSubmissionStatusFn = useCallback(async (id: string, status: SubmissionStatus) => {
    await jsonFetch(`/api/supervision/submissions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  }, []);

  const getBrief = useCallback(async (submissionId: string) => {
    const data = await jsonFetch<{ brief: unknown }>(`/api/supervision/submissions/${submissionId}/brief`);
    return data.brief;
  }, []);

  const getComparison = useCallback(async (submissionId: string) => {
    const data = await jsonFetch<{ comparison: unknown }>(`/api/supervision/submissions/${submissionId}/compare`);
    return data.comparison;
  }, []);

  const sendFeedback = useCallback(
    async (input: { submissionId: string; globalEvaluation: string; sections: FeedbackSectionEntry[] }) => {
      const data = await jsonFetch<{ feedbackText: string; email: { status: string } }>("/api/supervision/feedback", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return data;
    },
    []
  );

  const updateCorrectionStatusFn = useCallback(async (id: string, status: CorrectionStatus) => {
    await jsonFetch(`/api/supervision/corrections/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  }, []);

  const addCorrectionDiscussion = useCallback(async (id: string, body: string) => {
    await jsonFetch(`/api/supervision/corrections/${id}/discussion`, { method: "POST", body: JSON.stringify({ body }) });
  }, []);

  const unreadNotificationCount = notifications.filter((n) => !n.readAt).length;

  return (
    <SupervisionContext.Provider
      value={{
        notifications,
        unreadNotificationCount,
        refreshNotifications,
        markNotificationRead,
        messages,
        refreshMessages,
        markMessageRead,
        becomeSupervisor,
        getProfile,
        saveProfile,
        listCanevas,
        createCanevas: createCanevasFn,
        updateCanevas: updateCanevasFn,
        listInvitations,
        createInvitation: createInvitationFn,
        acceptInvitation,
        listMyStudents,
        getMySupervisor,
        listSubmissions,
        submitVersion,
        getSubmissionDetail,
        updateSubmissionStatus: updateSubmissionStatusFn,
        getBrief,
        getComparison,
        sendFeedback,
        updateCorrectionStatus: updateCorrectionStatusFn,
        addCorrectionDiscussion,
      }}
    >
      {children}
    </SupervisionContext.Provider>
  );
}

export function useSupervision(): SupervisionContextValue {
  const ctx = useContext(SupervisionContext);
  if (!ctx) throw new Error("useSupervision doit être utilisé à l'intérieur de SupervisionProvider.");
  return ctx;
}
