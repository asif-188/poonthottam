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

async function inspectAll() {
  const allCollections = [
    "cash_sales",
    "cash_purchases",
    "salesman_cash",
    "salesman_purchases",
    "salesman_expenses",
    "salesman_transfers",
    "payments",
    "salesman_daily_cash",
    "salesman_flower_purchases",
    "salesman_credit_transfers",
    "sales",
    "outside_purchases",
    "intakes",
    "buyers",
    "vendors",
    "salesmen"
  ];

  console.log("=== INSPECTING ALL COLLECTIONS FOR DATE 2026-07-29 ===");

  for (const colName of allCollections) {
    const snap = await getDocs(collection(db, colName));
    const matched = [];
    snap.forEach(d => {
      const data = d.data();
      const dateStr = data.date || (data.timestamp ? data.timestamp.split("T")[0] : "");
      if (dateStr === "2026-07-29") {
        matched.push({ id: d.id, ...data });
      }
    });

    if (matched.length > 0) {
      console.log(`\n========================================`);
      console.log(`Collection: ${colName} (${matched.length} items on 2026-07-29):`);
      matched.forEach(m => {
        console.log(JSON.stringify(m, null, 2));
      });
    }
  }
}

inspectAll().catch(console.error);
