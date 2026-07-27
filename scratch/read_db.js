import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwwHJCS42BWTOp9udAmBvFyAGJzQO2700",
  authDomain: "poovanam-24ba8.firebaseapp.com",
  projectId: "poovanam-24ba8",
  storageBucket: "poovanam-24ba8.firebasestorage.app",
  messagingSenderId: "555385420169",
  appId: "1:555385420169:web:824144f55979d076060958"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const vendorsSnap = await getDocs(collection(db, "vendors"));
  const vendors = [];
  vendorsSnap.forEach(doc => {
    vendors.push({ id: doc.id, ...doc.data() });
  });

  const matchingVendors = vendors.filter(v => {
    const name = (v.name || "").toLowerCase();
    const nameTa = (v.nameTa || "").toLowerCase();
    return name.includes("sahayam") || nameTa.includes("சகாயம்") || name.includes("as") || nameTa.includes("ஏஎஸ்");
  });

  console.log(`Found ${matchingVendors.length} matching vendors:`);
  for (const v of matchingVendors) {
    console.log(`\n========================================`);
    console.log(`Vendor: ${v.name} / ${v.nameTa}`);
    console.log(`ID: ${v.id}`);
    console.log(`TenantId: ${v.tenantId}`);
    console.log(`Balance: ${v.balance}`);
    console.log(`Opening Balance field in doc: ${v.openingBalance}`);

    const purchasesSnap = await getDocs(collection(db, "outside_purchases"));
    const purchases = [];
    purchasesSnap.forEach(doc => {
      const data = doc.data();
      if (data.vendorId === v.id) {
        purchases.push({ id: doc.id, ...data });
      }
    });
    console.log(`Purchases (${purchases.length}):`);
    purchases.sort((a,b)=>a.date.localeCompare(b.date)).forEach(p => {
      console.log(`  - Purchase: Date=${p.date}, Total=${p.grandTotal}, ID=${p.id}`);
    });

    const paymentsSnap = await getDocs(collection(db, "payments"));
    const payments = [];
    paymentsSnap.forEach(doc => {
      const data = doc.data();
      if (data.entityId === v.id && data.type === "vendor") {
        payments.push({ id: doc.id, ...data });
      }
    });
    console.log(`Payments (${payments.length}):`);
    payments.sort((a,b)=>a.date.localeCompare(b.date)).forEach(p => {
      console.log(`  - Payment: Date=${p.date}, Amount=${p.amount}, ID=${p.id}`);
    });
  }
}

run().catch(console.error);
