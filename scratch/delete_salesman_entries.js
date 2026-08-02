import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, deleteDoc, setDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";

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

// Specific document IDs identified for Sheriff on 29/07/2026
const targets = [
  { collectionName: "payments", id: "ThaHB0VFIIBCxRZ1qGp5", label: "Parcel Collection (₹69,550)" },
  { collectionName: "cash_sales", id: "4XheXHK9r8kPW7ZwNzON", label: "Cash Sales - Thakkaali, Malligai, Taj Mahal (₹6,080)" },
  { collectionName: "cash_sales", id: "daTlFevngllSzdz3Hst0", label: "Cash Sales - Sendu (₹1,050)" },
  { collectionName: "cash_purchases", id: "sZiSpZiaz3w4MgSMDFeo", label: "Cash Purchase - Sendu, Thakkaali, Malligai, Taj Mahal (₹6,230)" }
];

async function deleteEntries() {
  console.log("=== DELETING SALESMAN ENTRIES FOR SHERIFF (29/07/2026) ===\n");
  
  for (const item of targets) {
    const docRef = doc(db, item.collectionName, item.id);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      const data = snap.data();
      
      // Save to recycle_bin for safety
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      await addDoc(collection(db, 'recycle_bin'), {
        originalId: item.id,
        collectionName: item.collectionName,
        deletedAt: serverTimestamp(),
        expiryDate: expiryDate,
        tenantId: data.tenantId || 'demo',
        data: data,
        details: `Deleted entry from Salesman Report: ${item.label}`
      });

      // Delete from Firestore
      await deleteDoc(docRef);
      console.log(`[SUCCESS] Deleted: ${item.label} (Collection: ${item.collectionName}, ID: ${item.id})`);
    } else {
      console.log(`[NOT FOUND] Already deleted or missing: ${item.label} (ID: ${item.id})`);
    }
  }

  console.log("\n=== Deletion complete. All entries moved to Recycle Bin and removed from Firestore. ===");
}

deleteEntries().catch(console.error);
