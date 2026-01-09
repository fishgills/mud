import Link from 'next/link';
import { getPrismaClient } from '@mud/database';
import { getSession } from '../lib/slack-auth';

export const metadata = {
  title: 'Character',
};

const getPlayerForSlackUser = async (teamId: string, userId: string) => {
  const prisma = getPrismaClient();
  const slackUser = await prisma.slackUser.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      player: true,
    },
  });
  return slackUser?.player ?? null;
};

export default async function CharacterPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Your Character
          </h1>
        </header>
        <div className="section-divider" aria-hidden="true">
          <svg
            className="divider-icon"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Crossed blades"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 4l4 4" />
            <path d="M4 5l3 3" />
            <path d="M9 9l-2 2" />
            <path d="M19 4l-4 4" />
            <path d="M20 5l-3 3" />
            <path d="M15 9l2 2" />
            <path d="M7 13l10 6" />
            <path d="M17 13l-10 6" />
          </svg>
        </div>
        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>You are not signed in.</p>
        </section>
        <div>
          <Link className="slack-auth-link" href="/api/auth/slack/start">
            Sign in with Slack
          </Link>
        </div>
      </main>
    );
  }

  const player = await getPlayerForSlackUser(session.teamId, session.userId);

  if (!player) {
    return (
      <main className="page-card flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="title-font text-3xl font-semibold tracking-tight">
            Your Character
          </h1>
        </header>
        <div className="section-divider" aria-hidden="true">
          <svg
            className="divider-icon"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Crossed blades"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 4l4 4" />
            <path d="M4 5l3 3" />
            <path d="M9 9l-2 2" />
            <path d="M19 4l-4 4" />
            <path d="M20 5l-3 3" />
            <path d="M15 9l2 2" />
            <path d="M7 13l10 6" />
            <path d="M17 13l-10 6" />
          </svg>
        </div>
        <section className="text-base leading-7 text-[color:var(--ink-soft)]">
          <p>No character was found for this Slack account.</p>
          <p>
            Start a character in Slack by messaging the BattleForge bot with
            <span className="font-semibold"> new YourName</span>.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-card flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="title-font text-3xl font-semibold tracking-tight">
          Your Character
        </h1>
      </header>
      <div className="section-divider" aria-hidden="true">
        <svg
          className="divider-icon"
          viewBox="0 0 24 24"
          role="img"
          aria-label="Crossed blades"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 4l4 4" />
          <path d="M4 5l3 3" />
          <path d="M9 9l-2 2" />
          <path d="M19 4l-4 4" />
          <path d="M20 5l-3 3" />
          <path d="M15 9l2 2" />
          <path d="M7 13l10 6" />
          <path d="M17 13l-10 6" />
        </svg>
      </div>
      <section className="text-base leading-7 text-[color:var(--ink-soft)]">
        <p className="text-xl font-semibold text-[color:var(--ink)]">
          {player.name}
        </p>
        <p>Level {player.level}</p>
        <p>
          HP {player.hp} / {player.maxHp}
        </p>
        <p>XP {player.xp}</p>
        <p>Gold {player.gold}</p>
        <p>Strength {player.strength}</p>
        <p>Agility {player.agility}</p>
        <p>Health {player.health}</p>
      </section>
    </main>
  );
}
