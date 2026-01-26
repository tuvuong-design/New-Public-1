import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin123456";
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";

  const passwordHash = await hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: "ADMIN" },
    create: { email, name, passwordHash, role: "ADMIN" },
  });

  const grant = Number(process.env.SEED_ADMIN_STARS ?? "0");
  if (grant > 0) {
    await prisma.user.update({ where: { id: user.id }, data: { starBalance: grant } });
  }

  return { user, password };
}

async function seedConfigs() {
  await prisma.siteConfig.upsert({ where: { id: 1 }, update: {}, create: {} });

  await prisma.hlsConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      segmentSeconds: 6,
      packaging: "SINGLE_FILE",
      ladderJson: JSON.stringify(
        [
          { height: 1080, videoKbps: 5000, audioKbps: 128, maxMb: 200 },
          { height: 720, videoKbps: 2800, audioKbps: 128, maxMb: 200 },
          { height: 480, videoKbps: 1400, audioKbps: 96, maxMb: 200 },
          { height: 360, videoKbps: 900, audioKbps: 64, maxMb: 200 },
        ],
        null,
        2
      ),
    },
  });
}

async function seedAdPlacements() {
  for (const scope of ["FEED", "VIDEO", "COMMENTS", "RELATED", "GLOBAL_TOP", "GLOBAL_BOTTOM"] as const) {
    await prisma.adPlacement.upsert({
      where: { scope },
      update: {},
      create: {
        scope,
        enabled: false,
        everyN: scope === "COMMENTS" ? 10 : scope.startsWith("GLOBAL_") ? 0 : 6,
        html: "<div>Ad slot</div>",
      },
    });
  }
}

async function seedBoostPlans() {
  const plans = [
    { name: "Boost 1 day", type: "DURATION", durationDays: 1, priceStars: 50, sort: 10 },
    { name: "Boost 7 days", type: "DURATION", durationDays: 7, priceStars: 250, sort: 20 },
    { name: "Boost 30 days", type: "DURATION", durationDays: 30, priceStars: 900, sort: 30 },
    { name: "Target 1k views", type: "TARGET_INTERACTIONS", targetViews: 1000, priceStars: 120, sort: 40 },
    { name: "Target 5k views", type: "TARGET_INTERACTIONS", targetViews: 5000, priceStars: 450, sort: 50 },
  ] as const;

  for (const p of plans) {
    await prisma.boostPlan.upsert({
      where: { name: p.name },
      update: { ...p, active: true },
      create: { ...p, active: true },
    });
  }
}

async function seedGifts() {
  const gifts = [
    { name: "Rose", icon: "🌹", starsCost: 1, sort: 10 },
    { name: "Like", icon: "👍", starsCost: 3, sort: 20 },
    { name: "Heart", icon: "❤️", starsCost: 5, sort: 30 },
    { name: "Coffee", icon: "☕", starsCost: 10, sort: 40 },
    { name: "Diamond", icon: "💎", starsCost: 50, sort: 50 },
    { name: "Rocket", icon: "🚀", starsCost: 99, sort: 60 },
  ] as const;

  for (const g of gifts) {
    await prisma.gift.upsert({
      where: { name: g.name },
      update: { icon: g.icon, starsCost: g.starsCost, active: true, sort: g.sort },
      create: { name: g.name, icon: g.icon, starsCost: g.starsCost, active: true, sort: g.sort },
    });
  }
}

async function seedBadges() {
  const badges = [
    { key: "FIRST_LIKE", name: "First Like", description: "Thả tim lần đầu", icon: "❤️" },
    { key: "FIRST_COMMENT", name: "First Comment", description: "Bình luận lần đầu", icon: "💬" },
    { key: "FIRST_UPLOAD", name: "First Upload", description: "Upload video lần đầu", icon: "🎬" },
    { key: "FIRST_TIP", name: "First Tip", description: "Tip creator lần đầu", icon: "⭐" },
    { key: "LEVEL_5", name: "Level 5", description: "Đạt level 5", icon: "🏅" },
    { key: "LEVEL_10", name: "Level 10", description: "Đạt level 10", icon: "🏆" },
  ] as const;

  for (const b of badges) {
    await prisma.badge.upsert({
      where: { key: b.key },
      update: { name: b.name, description: b.description, icon: b.icon },
      create: { key: b.key, name: b.name, description: b.description, icon: b.icon },
    });
  }
}

async function seedApiSources() {
  // NOTE: These are optional demo sources. Owners can be assigned via env:
  // - SEED_PEERTUBE_OWNER_EMAIL
  // - SEED_ZONE3S_OWNER_EMAIL
  const sources = [
    {
      name: "PeerTube3 (public videos)",
      baseUrl: "https://peertube3.cpy.re/api/v1/videos?sort=-publishedAt&count=50&nsfw=both",
      prefix: "peertube3",
      mappingJson: JSON.stringify(
        {
          kind: "peertube",
          items: "data",
          id: "uuid",
          title: "name",
          description: "description",
          thumb: "thumbnailPath",
          hls: "streamingPlaylists.0.playlistUrl",
          durationSec: "duration",
          channelName: "channel.displayName",
          channelSlug: "channel.name",
          assignToUserEmailEnv: "SEED_PEERTUBE_OWNER_EMAIL",
        },
        null,
        2
      ),
    },
    {
      name: "Zone3s posts API",
      baseUrl: "https://test.zone3s.com/themes/api-posts_mysqli.php",
      prefix: "zone3s",
      mappingJson: JSON.stringify(
        {
          kind: "zone3s_posts",
          items: "posts",
          id: "post_id",
          title: "post_title",
          description: "post_content",
          thumb: "post_thumbnail",
          hls: "post_stream",
          durationSec: "durationSec",
          assignToUserEmailEnv: "SEED_ZONE3S_OWNER_EMAIL",
        },
        null,
        2
      ),
    },
  ] as const;

  for (const s of sources) {
    await prisma.apiSource.upsert({
      where: { prefix: s.prefix },
      // Do not force-enable on existing installs.
      update: { name: s.name, baseUrl: s.baseUrl, mappingJson: s.mappingJson },
      create: { name: s.name, baseUrl: s.baseUrl, prefix: s.prefix, mappingJson: s.mappingJson, enabled: false },
    });
  }
}

async function seedNftContracts() {
  // Primary contract is pre-deployed on Polygon (can be changed later via Admin UI with delay).
  const polygonAddress =
    process.env.NFT_POLYGON_PRIMARY_CONTRACT_ADDRESS ?? "0xF6E5fEB76959f59c80023392386B997B068c27c6";

  // Solana collection/program address (can be changed later via Admin UI with delay).
  // Default provided by owner: EYXjrNBgpacCXo5a6smeGnUijFf5eiFHew5torEta216
  const solanaAddress = process.env.NFT_SOLANA_CONTRACT_ADDRESS ?? "EYXjrNBgpacCXo5a6smeGnUijFf5eiFHew5torEta216";

  await prisma.nftChainContract.upsert({
    where: { chain: "POLYGON" },
    update: { address: polygonAddress, isPrimary: true },
    create: { chain: "POLYGON", address: polygonAddress, isPrimary: true },
  });

  await prisma.nftChainContract.upsert({
    where: { chain: "SOLANA" },
    update: { address: solanaAddress, isPrimary: false },
    create: { chain: "SOLANA", address: solanaAddress, isPrimary: false },
  });

  // Optional: allow setting other chains via env (not primary by default).
  const optional = [
    { chain: "ETHEREUM" as const, env: "NFT_ETHEREUM_CONTRACT_ADDRESS" },
    { chain: "BSC" as const, env: "NFT_BSC_CONTRACT_ADDRESS" },
    { chain: "BASE" as const, env: "NFT_BASE_CONTRACT_ADDRESS" },
    { chain: "TRON" as const, env: "NFT_TRON_CONTRACT_ADDRESS" },
  ];
  for (const c of optional) {
    const addr = (process.env as any)[c.env] as string | undefined;
    if (!addr) continue;
    await prisma.nftChainContract.upsert({
      where: { chain: c.chain },
      update: { address: addr, isPrimary: false },
      create: { chain: c.chain, address: addr, isPrimary: false },
    });
  }
}

async function main() {
  const { user, password } = await seedAdmin();
  await seedConfigs();
  await seedAdPlacements();
  await seedBoostPlans();
  await seedGifts();
  await seedBadges();
  await seedApiSources();
  await seedNftContracts();

  console.log("Seeded admin:", user.email, "password:", password);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
