import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toEmployee(user) {
  if (!user) return null;

  return {
    uid: user.uid,
    email: user.email || "",
  };
}

export function getAuthErrorMessage(error) {
  const code = error?.code || "";

  if (code.includes("auth/invalid-email")) {
    return "Email không hợp lệ.";
  }

  if (code.includes("auth/missing-password")) {
    return "Vui lòng nhập mật khẩu.";
  }

  if (code.includes("auth/weak-password")) {
    return "Mật khẩu cần ít nhất 6 ký tự.";
  }

  if (code.includes("auth/email-already-in-use")) {
    return "Email này đã được tạo tài khoản.";
  }

  if (
    code.includes("auth/invalid-credential") ||
    code.includes("auth/user-not-found") ||
    code.includes("auth/wrong-password")
  ) {
    return "Email hoặc mật khẩu không đúng.";
  }

  return error?.message || "Không thể xử lý yêu cầu đăng nhập.";
}

export async function registerEmployee(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const result = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  const employeeRef = doc(db, "employees", result.user.uid);

  await setDoc(employeeRef, {
    uid: result.user.uid,
    email: normalizedEmail,
    role: "employee",
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return toEmployee(result.user);
}

export async function loginEmployee(email, password) {
  const result = await signInWithEmailAndPassword(
    auth,
    normalizeEmail(email),
    password
  );

  const employeeRef = doc(db, "employees", result.user.uid);
  const employeeSnap = await getDoc(employeeRef);

  if (!employeeSnap.exists()) {
    await setDoc(
      employeeRef,
      {
        uid: result.user.uid,
        email: result.user.email || normalizeEmail(email),
        role: "employee",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  return toEmployee(result.user);
}

export async function logoutEmployee() {
  await signOut(auth);
}

export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(toEmployee(user));
  });
}

export async function getCurrentEmployeeToken(forceRefresh = false) {
  if (!auth.currentUser) return "";
  return auth.currentUser.getIdToken(forceRefresh);
}
