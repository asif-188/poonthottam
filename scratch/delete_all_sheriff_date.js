import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, deleteDoc, serverTimestamp, addDoc } from "firebase/firestore";

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

const sheriffId = "1uGJawvIGixfiltk4rNu"; // Sherif
const targetDate = "2026-07-29";

const collectionsToCheck = [
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

async function deleteAllSheriffEntriesForDate() {
  console.log(`=== DELETING ALL SHERIFF (${sheriffId}) ENTRIES FOR DATE ${targetDate} ===\n`);

  let totalDeleted = 0;

  for (const colName of collectionsToCheck) {
    const snap = await getDocs(collection(db, colName));
    
    for (const d of snap.docs) {
      const data = d.data();
      const dateVal = data.date || (data.timestamp ? data.timestamp.split("T")[0] : null);

      if (dateVal === targetDate) {
        const isSheriff = data.salesmanId === sheriffId || 
                          data.salesman_id === sheriffId || 
                          data.fromSalesmanId === sheriffId || 
                          data.toSalesmanId === sheriffId;

        if (isSheriff) {
          const docRef = doc(db, colName, d.id);
          
          // Back up to recycle bin
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + 30);
          await addDoc(collection(db, 'recycle_bin'), {
            originalId: d.id,
            collectionName: colName,
            deletedAt: serverTimestamp(),
            expiryDate: expiryDate,
            tenantId: data.tenantId || 'demo',
            data: data,
            details: `Deleted ${colName} entry for Sheriff on ${targetDate}`
          });

          await deleteDoc(docRef);
          totalDeleted++;
          console.log(`[DELETED] Collection: ${colName}, ID: ${d.id}, Details:`, JSON.stringify(data));
        }
      }
    }
  }

  console.log(`\n=== Finished deleting ${totalDeleted} entries for Sheriff on ${targetDate}. All backed up to Recycle Bin. ===`);
}

deleteAllSheriffEntriesForDate().catch(console.error);
