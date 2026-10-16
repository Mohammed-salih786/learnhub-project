import { InstructorShell } from "@/components/layout/instructor-shell";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default function InstructorProfilePage() {
  return <InstructorShell><ProfileEditor role="instructor" /></InstructorShell>;
}
