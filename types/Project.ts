export type ProjectStatus =
  | "active"
  | "completed"
  | "archived";

export interface Project {
  id: string;

  name: string;

  title: string;

  university: string;

  faculty: string;

  department: string;

  level: "Licence" | "Master" | "Doctorat";

  director: string;

  academicYear: string;

  progress: number;

  currentChapter: string;

  status: ProjectStatus;

  updatedAt: string;

  createdAt: string;
}