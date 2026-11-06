import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionService } from "@/services/session.service";
import { ContactDetail } from "@/components/wholesale/ledger/ContactDetail";
import type { LedgerEntry } from "@/components/wholesale/ledger/types";

export default async function LedgerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ contactId: string }>;
  searchParams: Promise<{ businessUnitId?: string }>;
}) {
  const current = await SessionService.getCurrent();
  if (!current) redirect("/login?returnTo=/wholesale/ledger");

  const { contactId } = await params;
  const sp = await searchParams;
  const contactIdNum = parseInt(contactId, 10);
  if (isNaN(contactIdNum) || contactIdNum <= 0) notFound();

  // Verify user owns the BU that owns this contact
  const contact = await prisma.ledgerContact.findFirst({
    where: { id: contactIdNum, deletedAt: null },
    include: {
      businessUnit: {
        select: {
          id: true,
          owner: { select: { userId: true } },
          members: {
            where: {
              userId: current.user.id,
              isActive: true,
              deletedAt: null,
            },
            select: { id: true },
          },
        },
      },
      entries: {
        orderBy: [{ entryDate: "desc" }, { id: "desc" }],
        take: 200,
      },
    },
  });

  if (!contact) notFound();

  const isOwner = contact.businessUnit.owner.userId === current.user.id;
  const isMember = contact.businessUnit.members.length > 0;
  const isAdmin =
    current.user.role === "ADMIN" || current.user.role === "SUPER_ADMIN";
  if (!isOwner && !isMember && !isAdmin) notFound();

  const serializedContact = {
    id: contact.id,
    name: contact.name,
    contactType: contact.contactType,
    phone: contact.phone,
    email: contact.email,
    notes: contact.notes,
    linkedUserId: contact.linkedUserId,
    linkedBUId: contact.linkedBUId,
    openingBalance: Number(contact.openingBalance),
    currentBalance: Number(contact.currentBalance),
    isActive: contact.isActive,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };

  const entries: LedgerEntry[] = contact.entries.map((e) => ({
    id: e.id,
    type: e.type,
    amount: Number(e.amount),
    balanceBefore: Number(e.balanceBefore),
    balanceAfter: Number(e.balanceAfter),
    description: e.description,
    entryDate: e.entryDate.toISOString(),
    referenceType: e.referenceType,
    referenceId: e.referenceId,
    attachmentUrl: e.attachmentUrl,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <ContactDetail
      businessUnitId={contact.businessUnit.id}
      contact={serializedContact}
      initialEntries={entries}
    />
  );
}