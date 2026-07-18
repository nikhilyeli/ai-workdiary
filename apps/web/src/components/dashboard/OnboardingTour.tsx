"use client";

import { useEffect } from "react";
import introJs from "intro.js";
import "intro.js/introjs.css";

interface Props {
  onDone: () => void;
}

export default function OnboardingTour({ onDone }: Props) {
  useEffect(() => {
    const intro = introJs();
    intro.setOptions({
      steps: [
        {
          title: "Welcome to AI Work Diary 📓",
          intro:
            "This is your personal worklog orchestrator. It helps you review activities from Jira, Bitbucket, and other sources, then draft worklogs — without auto-submitting anything.",
        },
        {
          element: "#tab-activities",
          title: "Activities",
          intro:
            "Here you can see all your collected work activities. Review, edit, add ticket numbers, and approve entries before creating worklog drafts.",
        },
        {
          element: "#pending-badge",
          title: "Pending Review",
          intro:
            "This badge shows how many activities are waiting for your review. Always check these before generating worklogs.",
          disableInteraction: true,
        },
        {
          element: "#add-activity-btn",
          title: "Add Manual Entry",
          intro:
            "Can't find an activity? Add it manually with a title, ticket number, and description.",
        },
        {
          element: "#tab-worklogs",
          title: "Worklog Drafts",
          intro:
            "Once you approve activities, worklog drafts appear here. Review them carefully, then manually enter them into Atlassian Worklog Pro and mark them as logged.",
        },
        {
          element: "#tab-sessions",
          title: "Sessions",
          intro:
            "You can sign in from multiple devices with the same account. Manage your active sessions here and revoke any you don't recognise.",
        },
      ],
      showProgress: true,
      showBullets: false,
      exitOnOverlayClick: false,
      nextLabel: "Next →",
      prevLabel: "← Back",
      doneLabel: "Got it!",
    });

    intro.oncomplete(onDone);
    intro.onexit(onDone);

    // Small delay so elements are rendered
    const timer = setTimeout(() => intro.start(), 300);
    return () => clearTimeout(timer);
  }, [onDone]);

  return null;
}
