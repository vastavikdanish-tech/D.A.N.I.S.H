import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { createPairingToken } from "@/lib/tokens";

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Authenticate via the dashboard first." }, { status: 401 });
  }

  const token = await createPairingToken(user.id);

  return NextResponse.json({
    ok: true,
    token,
    expiresInHours: 48,
    note: "Pass this token to the agent via the -PairingToken parameter.",
  });
}
