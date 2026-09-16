"use client";

import { Suspense } from "react";
import StatsCard from "../../components/dashboard/StatsCard";
import DashboardHeader from "../../components/dashboard/DashboardHeader";
import RecentActivity from "../../components/dashboard/RecentActivity";
import ProgressChart from "../../components/dashboard/ProgressChart";
import AssistantWidget from "../../components/assistant/AssistantWidget";
import QuickActions from "../../components/dashboard/QuickActions";
import ProgressGoals from "../../components/dashboard/ProgressGoals";
import NotificationsCenter from "../../components/dashboard/NotificationsCenter";
import CreditsCenter from "../../components/dashboard/CreditsCenter";
import AcademicCalendar from "../../components/dashboard/AcademicCalendar";
import OnboardingModal from "../../components/dashboard/OnboardingModal";
import UnderstandAcadia from "../../components/dashboard/UnderstandAcadia";
import MyEncadrement from "../../components/dashboard/MyEncadrement";
import RoleFocusWidget from "../../components/dashboard/RoleFocusWidget";
import { useResearch } from "@/contexts/ResearchContext";

import {
  FolderKanban,
  BrainCircuit,
  FileText,
  BarChart3,
} from "lucide-react";

export default function DashboardPage() {
  const { researches, datasets, instruments, exportHistory } = useResearch();

  const researchCount = researches.length;
  const datasetCount = Object.keys(datasets).length;
  const instrumentCount = Object.keys(instruments).length;
  const exportCount = Object.values(exportHistory).reduce((sum, entries) => sum + entries.length, 0);

  return (
    <div className="space-y-10 p-6 lg:p-8">
      <Suspense fallback={null}>
        <OnboardingModal />
      </Suspense>

      {/* Titre */}

      <DashboardHeader />

      {/* Ce qui attend l'utilisateur, adapté à son rôle réel (retour utilisateur) */}

      <RoleFocusWidget />

      {/* Éducation permanente — Comprendre ACADIA (P14) */}

      <UnderstandAcadia />

      {/* Statistiques — comptes réels issus de ResearchContext (P13) */}

      <div className="grid gap-6 xl:grid-cols-4 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1">

        <StatsCard
          title="Mes recherches"
          value={String(researchCount).padStart(2, "0")}
          color="bg-blue-100 text-blue-600"
          icon={<FolderKanban size={30} />}
        />

        <StatsCard
          title="Instruments créés"
          value={String(instrumentCount).padStart(2, "0")}
          color="bg-violet-100 text-violet-600"
          icon={<BrainCircuit size={30} />}
        />

        <StatsCard
          title="Datasets"
          value={String(datasetCount).padStart(2, "0")}
          color="bg-green-100 text-green-600"
          icon={<FileText size={30} />}
        />

        <StatsCard
          title="Documents exportés"
          value={String(exportCount).padStart(2, "0")}
          color="bg-orange-100 text-orange-600"
          icon={<BarChart3 size={30} />}
        />

      </div>

      {/* Activité récente */}

      <RecentActivity />

      {/* Progression */}

      <ProgressChart />

      {/* Assistant */}

      <AssistantWidget />

      {/* Actions */}

      <QuickActions />

      {/* Objectifs */}

      <ProgressGoals />

      {/* Mon encadrement (P16) */}

      <MyEncadrement />

      {/* Notifications */}

      <NotificationsCenter />

      {/* Crédits */}

      <CreditsCenter />

      {/* Calendrier */}

      <AcademicCalendar />

    </div>
  );
}
