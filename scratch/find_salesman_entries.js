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

async function findEntries() {
  // 1. Find salesmen
  const salesmenSnap = await getDocs(collection(db, "salesmen"));
  const salesmen = [];
  salesmenSnap.forEach(d => salesmen.push({ id: d.id, ...d.data() }));
  console.log("=== SALESMEN ===");
  salesmen.forEach(s => console.log(`ID: ${s.id}, Name: ${s.name}, NameTa: ${s.nameTa}`));

  const sheriff = salesmen.find(s => (s.name || "").toLowerCase().includes("sheriff") || (s.nameTa || "").includes("ஷெரீப்"));
  console.log("\nFound Sheriff:", sheriff);

  const collections = [
    "cash_sales",
    "cash_purchases",
    "salesman_cash",
    "salesman_purchases",
    "salesman_expenses",
    "salesman_transfers",
    "payments",
    "salesman_daily_cash",
    "salesman_flower_purchases",
    "salesman_credit_transfers"
  ];

  const dateToFind = "2026-07-29";

  for (const colName of collections) {
    const snap = await getDocs(collection(db, colName));
    const matchingDocs = [];
    snap.forEach(d => {
      const data = d.data();
      const dateVal = data.date || (data.timestamp ? data.timestamp.split("T")[0] : null);
      if (dateVal === dateToFind) {
        if (!sheriff || data.salesmanId === sheriff.id || data.salesman_id === sheriff.id || data.fromSalesmanId === sheriff.id || data.toSalesmanId === sheriff.id) {
          matchingDocs.push({ id: d.id, ...data });
        }
      }
    });

    if (matchingDocs.length > 0) {
      console.log(`\n=== Collection: ${colName} (${matchingDocs.length} docs on ${dateToFind}) ===`);
      matchingDocs.forEach(doc => {
        console.log(JSON.stringify(doc, null, 2));
      });
    }
  }
}

findEntries().catch(console.error);
