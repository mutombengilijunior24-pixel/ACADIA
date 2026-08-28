import { ReactNode } from "react";
import MainLayout from "../../components/layout/MainLayout";
import { ResearchProvider } from "@/contexts/ResearchContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SupervisionProvider } from "@/contexts/SupervisionContext";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProjectProvider>
      <ResearchProvider>
        <SupervisionProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </SupervisionProvider>
      </ResearchProvider>
    </ProjectProvider>
  );
}
