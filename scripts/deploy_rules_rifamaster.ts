import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing!");
}
const serviceAccount = JSON.parse(serviceAccountJson);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

const credential = admin.credential.cert(serviceAccount);

async function deployRulesToRifamaster() {
  const tokenObj = await credential.getAccessToken();
  const accessToken = tokenObj.access_token;
  const projectId = serviceAccount.project_id; // "rifamaster-prod"

  const rulesContent = fs.readFileSync(path.join(process.cwd(), "firestore.rules"), "utf-8");

  console.log(`🚀 Creating new Ruleset on Firebase project: ${projectId}...`);

  // 1. Create Ruleset
  const rulesetRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: {
        files: [
          {
            name: "firestore.rules",
            content: rulesContent,
          },
        ],
      },
    }),
  });

  if (!rulesetRes.ok) {
    const errorText = await rulesetRes.text();
    throw new Error(`Failed to create ruleset: ${rulesetRes.status} ${errorText}`);
  }

  const rulesetData = await rulesetRes.json();
  console.log(`✅ Ruleset created: ${rulesetData.name}`);

  // 2. Get existing releases to see release name(s)
  const releasesListRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const releasesListData = await releasesListRes.json();
  console.log("Existing releases:", JSON.stringify(releasesListData, null, 2));

  // Default Firestore release name is "cloud.firestore"
  const releaseName = `projects/${projectId}/releases/cloud.firestore`;

  console.log(`🚀 Updating release "${releaseName}" to ruleset "${rulesetData.name}"...`);

  const updateReleaseRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      release: {
        name: releaseName,
        rulesetName: rulesetData.name,
      },
    }),
  });

  if (!updateReleaseRes.ok) {
    // If release does not exist yet, try creating it with POST
    console.warn(`PATCH release returned ${updateReleaseRes.status}, trying POST creation...`);
    const createReleaseRes = await fetch(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: releaseName,
        rulesetName: rulesetData.name,
      }),
    });

    if (!createReleaseRes.ok) {
      const errText = await createReleaseRes.text();
      throw new Error(`Failed to update or create release: ${errText}`);
    } else {
      console.log(`✅ Release created successfully!`);
    }
  } else {
    const releaseData = await updateReleaseRes.json();
    console.log(`✅ Release updated successfully:`, releaseData.name, "->", releaseData.rulesetName);
  }

  console.log("\n🎉 Security rules successfully deployed to rifamaster-prod!");
}

deployRulesToRifamaster().catch((err) => {
  console.error("❌ Failed to deploy rules:", err);
  process.exit(1);
});
