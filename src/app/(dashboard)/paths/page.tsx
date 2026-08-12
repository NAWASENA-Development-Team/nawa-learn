import { db } from "@/db";
import { modules, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import PathsClient from "@/components/paths/PathsClient";

export const dynamic = "force-dynamic";

export default async function PathsPage() {
  // Fetch all approved modules to form the curriculum/paths
  const approvedModules = await db.query.modules.findMany({
    where: eq(modules.status, "approved"),
    orderBy: [desc(modules.createdAt)],
  });

  // Group by Grade -> Subject to form paths
  // Or we can just pass them to client to allow dynamic filtering and searching
  
  // Also fetch top 10 contributors to feature them in the paths dashboard
  const topUsersData = await db.query.users.findMany({
    orderBy: [desc(users.points)],
    limit: 5,
    columns: {
      id: true,
      name: true,
      points: true,
      avatarIndex: true,
      photoUrl: true,
    }
  });

  return (
    <PathsClient 
      allModules={approvedModules}
      topContributors={topUsersData}
    />
  );
}
