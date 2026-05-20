// Redirect stub. The publish article page moved to
// /admin/contentops/publishing/[id] in Commit H to put the operator surface
// on its own canonical route. This stub keeps stale bookmarks working;
// remove once logs show no traffic to this path.

import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function PreparePublishRedirect({ params }: PageProps) {
  const { id } = await params;
  redirect(`/admin/contentops/publishing/${id}`);
}
