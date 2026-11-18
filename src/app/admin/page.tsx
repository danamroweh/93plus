import { Editor } from "@/components/admin/Editor";
import { SignIn } from "@/components/admin/SignIn";
import { snapshot } from "@/lib/admin/data";
import { isAdmin, passwordIsSet } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) return <SignIn ready={passwordIsSet()} />;
  return <Editor initial={await snapshot()} />;
}
