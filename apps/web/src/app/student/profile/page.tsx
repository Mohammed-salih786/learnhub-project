import { StudentShell } from "@/components/layout/student-shell";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { InstructorApplicationForm } from "@/components/profile/instructor-application-form";

export default function ProfilePage() {
  return <StudentShell><ProfileEditor role="student" /><InstructorApplicationForm /></StudentShell>;
}
