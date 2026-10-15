export type VerificationProgress = {
  detail: string;
  sidebarLabel: string;
};

export function getVerificationProgress(
  issuerStatus: string,
  applicationStatus?: string | null,
): VerificationProgress {
  if (issuerStatus === "verified") {
    return { detail: "Issuer authority active", sidebarLabel: "Issuer verified" };
  }

  switch (applicationStatus) {
    case "submitted":
      return { detail: "ICS review in progress", sidebarLabel: "Verification in review" };
    case "needs_information":
      return { detail: "Update verification application", sidebarLabel: "Submit requested information" };
    case "rejected":
      return { detail: "Submit a replacement application", sidebarLabel: "Restart verification" };
    case null:
    case undefined:
      return { detail: "Application not started", sidebarLabel: "Start verification" };
    default:
      return { detail: "Review application status", sidebarLabel: "Review verification" };
  }
}
