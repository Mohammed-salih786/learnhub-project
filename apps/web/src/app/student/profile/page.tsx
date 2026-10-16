import { StudentShell } from "@/components/layout/student-shell";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default function ProfilePage() {
  return <StudentShell><ProfileEditor role="student" /></StudentShell>;
}
