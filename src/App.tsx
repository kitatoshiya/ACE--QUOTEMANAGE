import React, { useState, useEffect, useMemo } from "react";
import {
  ActiveView,
  AppBackground,
  AppTheme,
  ChatMessage,
  ChatTypingStatus,
  EmailMessage,
  EmailServerSettings,
  ExternalLink,
  FilterOptions,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  QuotationItem,
  QuoteMessage,
  QuoteStatus,
  StaffMember,
  UserProfile,
} from "./types";
import { INITIAL_EMAILS, DEFAULT_EMAIL_SETTINGS } from "./lib/initialEmails";
import {
  INITIAL_SAMPLE_QUOTES,
  INITIAL_SAMPLE_MESSAGES,
  INITIAL_SAMPLE_STAFF,
  INITIAL_SAMPLE_CHAT_MESSAGES,
  loadLocalQuotes,
  saveLocalQuotes,
  loadLocalMessages,
  saveLocalMessages,
  loadLocalStaff,
  saveLocalStaff,
  loadLocalChatMessages,
  saveLocalChatMessages,
  db,
  auth,
  cleanForFirestore,
  handleFirestoreError,
  OperationType,
} from "./lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  getDoc,
} from "firebase/firestore";
import { Navbar } from "./components/Navbar";
import { KanbanBoard, KANBAN_COLUMNS } from "./components/KanbanBoard";
import { StickyBoard } from "./components/StickyBoard";
import { EmailClient } from "./components/EmailClient";
import { isUserMentioned, processMentionNotificationsAndEmails, stripHtmlToPlainText } from "./lib/mentionUtils";
import { triggerDesktopNotification } from "./lib/notificationHelper";
import { NewQuoteModal } from "./components/NewQuoteModal";
import { ThreadDrawer } from "./components/ThreadDrawer";
import { BackupRestoreModal } from "./components/BackupRestoreModal";
import { UserSwitchModal } from "./components/UserSwitchModal";
import { StaffMasterModal } from "./components/StaffMasterModal";
import { AuthModal } from "./components/AuthModal";
import { ArchiveModal } from "./components/ArchiveModal";
import { KanbanChatWindow } from "./components/KanbanChatWindow";
import { BackgroundSettingsModal } from "./components/BackgroundSettingsModal";
import { NotificationSettingsModal } from "./components/NotificationSettingsModal";

export default function App() {
  // Current user state (persisted across restarts and page reloads)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("app_current_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return {
      name: "山田 太郎 (営業)",
      email: "yamada.sales@marinetrade.co.jp",
    };
  });

  // Sync current user state to localStorage
  useEffect(() => {
    if (currentUser?.email) {
      localStorage.setItem("app_current_user", JSON.stringify(currentUser));
    }
  }, [currentUser]);

  // App Theme state
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem("app_theme") as AppTheme) || "dark";
  });

  // Per-user Background state (managed individually per login ID)
  const [appBackground, setAppBackground] = useState<AppBackground>(() => {
    let initialUserEmail = "yamada.sales@marinetrade.co.jp";
    const savedUserStr = localStorage.getItem("app_current_user");
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.email) initialUserEmail = parsed.email.toLowerCase();
      } catch (e) {}
    }
    const saved = localStorage.getItem(`app_background_${initialUserEmail}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    const legacy = localStorage.getItem("app_background");
    if (legacy) {
      try {
        return JSON.parse(legacy);
      } catch (e) {
        // ignore
      }
    }
    return { type: "default", value: "" };
  });

  // Per-user Notification Preferences state
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() => {
    let initialUserEmail = "yamada.sales@marinetrade.co.jp";
    const savedUserStr = localStorage.getItem("app_current_user");
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.email) initialUserEmail = parsed.email.toLowerCase();
      } catch (e) {}
    }
    const saved = localStorage.getItem(`notification_prefs_${initialUserEmail}`);
    if (saved) {
      try {
        return normalizeNotificationPreferences(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_NOTIFICATION_PREFERENCES;
  });

  // Sync background and notification preferences whenever currentUser changes
  useEffect(() => {
    if (!currentUser?.email) return;
    const userKey = currentUser.email.toLowerCase();

    // 1. Load Background for current user
    const savedBg = localStorage.getItem(`app_background_${userKey}`);
    if (savedBg) {
      try {
        setAppBackground(JSON.parse(savedBg));
      } catch (e) {
        // ignore
      }
    } else {
      setAppBackground({ type: "default", value: "" });
    }

    if (db) {
      getDoc(doc(db, "user_backgrounds", userKey))
        .then((snap) => {
          if (snap.exists()) {
            const remoteBg = snap.data() as AppBackground;
            setAppBackground(remoteBg);
            localStorage.setItem(`app_background_${userKey}`, JSON.stringify(remoteBg));
          }
        })
        .catch((err) => {
          handleFirestoreError(err, OperationType.GET, `user_backgrounds/${userKey}`);
        });
    }

    // 2. Load Notification Preferences for current user
    const savedPrefs = localStorage.getItem(`notification_prefs_${userKey}`);
    if (savedPrefs) {
      try {
        setNotificationPreferences(normalizeNotificationPreferences(JSON.parse(savedPrefs)));
      } catch (e) {
        // ignore
      }
    } else {
      setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    }

    if (db) {
      getDoc(doc(db, "user_notification_prefs", userKey))
        .then((snap) => {
          if (snap.exists()) {
            const remotePrefs = snap.data() as NotificationPreferences;
            const normalized = normalizeNotificationPreferences(remotePrefs);
            setNotificationPreferences(normalized);
            localStorage.setItem(`notification_prefs_${userKey}`, JSON.stringify(normalized));
          }
        })
        .catch((err) => {
          handleFirestoreError(err, OperationType.GET, `user_notification_prefs/${userKey}`);
        });
    }

    // 3. Load Active View / Screen Mode for current user
    const savedView = localStorage.getItem(`app_active_view_${userKey}`);
    if (savedView && (savedView === "kanban" || savedView === "sticky_board" || savedView === "email")) {
      setActiveView(savedView as ActiveView);
    }

    if (db) {
      getDoc(doc(db, "user_active_views", userKey))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data?.activeView) {
              const remoteView = data.activeView as ActiveView;
              setActiveView(remoteView);
              localStorage.setItem(`app_active_view_${userKey}`, remoteView);
            }
          }
        })
        .catch((err) => {
          handleFirestoreError(err, OperationType.GET, `user_active_views/${userKey}`);
        });
    }
  }, [currentUser.email]);

  const handleSaveBackground = (newBg: AppBackground) => {
    setAppBackground(newBg);
    if (currentUser?.email) {
      const userKey = currentUser.email.toLowerCase();
      localStorage.setItem(`app_background_${userKey}`, JSON.stringify(newBg));
      if (db) {
        setDoc(doc(db, "user_backgrounds", userKey), cleanForFirestore(newBg)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `user_backgrounds/${userKey}`)
        );
      }
    }
  };

  const handleSaveNotificationPreferences = (newPrefs: NotificationPreferences) => {
    setNotificationPreferences(newPrefs);
    if (currentUser?.email) {
      const userKey = currentUser.email.toLowerCase();
      localStorage.setItem(`notification_prefs_${userKey}`, JSON.stringify(newPrefs));
      if (db) {
        setDoc(doc(db, "user_notification_prefs", userKey), cleanForFirestore(newPrefs)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `user_notification_prefs/${userKey}`)
        );
      }
    }
  };

  // Per-user Active View / Screen Mode state (managed individually per logged-in user in Firestore)
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    let initialUserEmail = "yamada.sales@marinetrade.co.jp";
    const savedUserStr = localStorage.getItem("app_current_user");
    if (savedUserStr) {
      try {
        const parsed = JSON.parse(savedUserStr);
        if (parsed?.email) initialUserEmail = parsed.email.toLowerCase();
      } catch (e) {}
    }
    const saved = localStorage.getItem(`app_active_view_${initialUserEmail}`);
    if (saved && (saved === "kanban" || saved === "sticky_board" || saved === "email")) {
      return saved as ActiveView;
    }
    return "kanban";
  });

  const handleSetActiveView = (newView: ActiveView) => {
    setActiveView(newView);
    if (currentUser?.email) {
      const userKey = currentUser.email.toLowerCase();
      localStorage.setItem(`app_active_view_${userKey}`, newView);
      if (db) {
        setDoc(doc(db, "user_active_views", userKey), {
          activeView: newView,
          updatedAt: new Date().toISOString(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `user_active_views/${userKey}`)
        );
      }
    }
  };

  // Sync theme class to document
  useEffect(() => {
    localStorage.setItem("app_theme", theme);
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark", "theme-cute", "theme-digital", "dark");
    root.classList.add(`theme-${theme}`);
    root.classList.add("dark");
  }, [theme]);

  // Staff members state
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(loadLocalStaff);

  // Quotation & Message state
  const [quotes, setQuotes] = useState<QuotationItem[]>(loadLocalQuotes);
  const [messages, setMessages] = useState<QuoteMessage[]>(loadLocalMessages);

  // Kanban Chat Messages state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(loadLocalChatMessages);
  const [chatTypingUsers, setChatTypingUsers] = useState<ChatTypingStatus[]>([]);

  useEffect(() => {
    saveLocalChatMessages(chatMessages);
  }, [chatMessages]);

  // Emails state (Common Email Client)
  const [emails, setEmails] = useState<EmailMessage[]>(() => {
    const saved = localStorage.getItem("marine_emails_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_EMAILS;
  });

  useEffect(() => {
    localStorage.setItem("marine_emails_v1", JSON.stringify(emails));
  }, [emails]);

  // Email Server Settings State (Shared across all users)
  const [emailServerSettings, setEmailServerSettings] = useState<EmailServerSettings>(() => {
    const saved = localStorage.getItem("marine_email_settings_v1");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_EMAIL_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem("marine_email_settings_v1", JSON.stringify(emailServerSettings));
  }, [emailServerSettings]);

  // Firestore Sync for Global Email Settings
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, "settings", "email_server");
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDoc(docRef, cleanForFirestore(DEFAULT_EMAIL_SETTINGS)).catch((err) =>
            handleFirestoreError(err, OperationType.WRITE, "settings/email_server")
          );
          setEmailServerSettings(DEFAULT_EMAIL_SETTINGS);
        } else {
          setEmailServerSettings(snapshot.data() as EmailServerSettings);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "settings/email_server");
      }
    );
    return () => unsubscribe();
  }, []);

  const handleUpdateEmailServerSettings = (newSettings: EmailServerSettings) => {
    const updated = {
      ...newSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser.email,
    };
    setEmailServerSettings(updated);
    if (db) {
      setDoc(doc(db, "settings", "email_server"), cleanForFirestore(updated)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, "settings/email_server")
      );
    }
  };

  // Wrapper for updating emails and syncing to Firestore
  const handleSetEmails: React.Dispatch<React.SetStateAction<EmailMessage[]>> = (valueOrFn) => {
    setEmails((prev) => {
      const next = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn;
      if (db) {
        next.forEach((em) => {
          setDoc(doc(db, "emails", em.id), cleanForFirestore(em)).catch((err) =>
            handleFirestoreError(err, OperationType.WRITE, `emails/${em.id}`)
          );
        });
      }
      return next;
    });
  };

  // Active UI modal states
  const [isNewQuoteOpen, setIsNewQuoteOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isUserSwitchOpen, setIsUserSwitchOpen] = useState(false);
  const [isStaffMasterOpen, setIsStaffMasterOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isBgSettingsOpen, setIsBgSettingsOpen] = useState(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Firestore test connection on boot
  useEffect(() => {
    async function testConnection() {
      if (!db) return;
      try {
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (error) {
        if (error instanceof Error && error.message.includes("the client is offline")) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // 1. Real-time Firestore Sync for Staff Members
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "staffMembers");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          // Initial seed if empty
          INITIAL_SAMPLE_STAFF.forEach((s) => {
            setDoc(doc(db, "staffMembers", s.id), cleanForFirestore(s)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `staffMembers/${s.id}`)
            );
          });
          setStaffMembers(INITIAL_SAMPLE_STAFF);
          saveLocalStaff(INITIAL_SAMPLE_STAFF);
        } else {
          const remoteStaff: StaffMember[] = [];
          snapshot.forEach((d) => remoteStaff.push(d.data() as StaffMember));
          setStaffMembers(remoteStaff);
          saveLocalStaff(remoteStaff);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "staffMembers");
      }
    );
    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore Sync for Quotations
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "quotations");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          // Initial seed if empty
          INITIAL_SAMPLE_QUOTES.forEach((q) => {
            setDoc(doc(db, "quotations", q.id), cleanForFirestore(q)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `quotations/${q.id}`)
            );
          });
          setQuotes(INITIAL_SAMPLE_QUOTES);
          saveLocalQuotes(INITIAL_SAMPLE_QUOTES);
        } else {
          const remoteQuotes: QuotationItem[] = [];
          snapshot.forEach((d) => remoteQuotes.push(d.data() as QuotationItem));
          remoteQuotes.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setQuotes(remoteQuotes);
          saveLocalQuotes(remoteQuotes);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "quotations");
      }
    );
    return () => unsubscribe();
  }, []);

  const isInitialMessagesLoad = React.useRef(true);

  // 3. Real-time Firestore Sync for Messages
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "messages");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          // Initial seed if empty
          INITIAL_SAMPLE_MESSAGES.forEach((m) => {
            setDoc(doc(db, "messages", m.id), cleanForFirestore(m)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `messages/${m.id}`)
            );
          });
          setMessages(INITIAL_SAMPLE_MESSAGES);
          saveLocalMessages(INITIAL_SAMPLE_MESSAGES);
        } else {
          const remoteMsgs: QuoteMessage[] = [];
          snapshot.forEach((d) => remoteMsgs.push(d.data() as QuoteMessage));
          remoteMsgs.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          if (!isInitialMessagesLoad.current) {
            snapshot.docChanges().forEach((change) => {
              if (change.type === "added") {
                const newMsg = change.doc.data() as QuoteMessage;
                if (isUserMentioned(newMsg.contentHtml, currentUser, staffMembers)) {
                  triggerDesktopNotification(
                    `🔔 [メンション通知] ${newMsg.authorName || newMsg.authorEmail}さんからのメッセージ`,
                    `あなた宛てにメンションが届きました:\n${stripHtmlToPlainText(newMsg.contentHtml).slice(0, 80)}`,
                    `mention-${newMsg.id}`
                  );
                }
              }
            });
          } else {
            isInitialMessagesLoad.current = false;
          }

          setMessages(remoteMsgs);
          saveLocalMessages(remoteMsgs);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "messages");
      }
    );
    return () => unsubscribe();
  }, [currentUser, staffMembers]);

  // 3b. Real-time Firestore Sync for Kanban Chat Messages
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "chat_messages");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (snapshot.empty) {
          INITIAL_SAMPLE_CHAT_MESSAGES.forEach((m) => {
            setDoc(doc(db, "chat_messages", m.id), cleanForFirestore(m)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `chat_messages/${m.id}`)
            );
          });
          setChatMessages(INITIAL_SAMPLE_CHAT_MESSAGES);
          saveLocalChatMessages(INITIAL_SAMPLE_CHAT_MESSAGES);
        } else {
          const remoteChatMsgs: ChatMessage[] = [];
          snapshot.forEach((d) => remoteChatMsgs.push(d.data() as ChatMessage));
          remoteChatMsgs.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setChatMessages(remoteChatMsgs);
          saveLocalChatMessages(remoteChatMsgs);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "chat_messages");
      }
    );
    return () => unsubscribe();
  }, []);

  // 3c. Real-time Firestore Sync for Kanban Chat Typing Status
  useEffect(() => {
    if (!db) return;
    const colRef = collection(db, "chat_typing");
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const typingStatuses: ChatTypingStatus[] = [];
        snapshot.forEach((d) => typingStatuses.push(d.data() as ChatTypingStatus));
        setChatTypingUsers(typingStatuses);
      },
      (error) => {
        console.error("Error fetching typing status:", error);
      }
    );
    return () => unsubscribe();
  }, []);

  // Sync with Firebase Auth user changes
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        const userEmail = firebaseUser.email;
        const matchingStaff = staffMembers.find(
          (s) => s.email.toLowerCase() === userEmail.toLowerCase()
        );

        if (matchingStaff) {
          setCurrentUser({
            name: matchingStaff.name,
            email: userEmail,
            employeeNumber: matchingStaff.employeeNumber,
          });
        } else {
          const newName = firebaseUser.displayName || userEmail.split("@")[0];
          const autoStaff: StaffMember = {
            id: `staff-${Date.now()}`,
            name: newName,
            email: userEmail,
          };
          setStaffMembers((prev) => {
            if (prev.some((s) => s.email.toLowerCase() === userEmail.toLowerCase())) {
              return prev;
            }
            return [...prev, autoStaff];
          });
          if (db) {
            setDoc(doc(db, "staffMembers", autoStaff.id), cleanForFirestore(autoStaff)).catch(
              (err) => handleFirestoreError(err, OperationType.WRITE, `staffMembers/${autoStaff.id}`)
            );
          }
          setCurrentUser({
            name: newName,
            email: userEmail,
          });
        }
      }
    });
    return () => unsubscribe();
  }, [staffMembers]);

  // Auth & Profile Handlers
  const handleLoginSuccess = (userProfile: UserProfile, newStaff?: StaffMember) => {
    if (newStaff) {
      setStaffMembers((prev) => {
        if (prev.some((s) => s.email.toLowerCase() === newStaff.email.toLowerCase())) {
          return prev.map((s) =>
            s.email.toLowerCase() === newStaff.email.toLowerCase() ? newStaff : s
          );
        }
        return [...prev, newStaff];
      });
      if (db) {
        setDoc(doc(db, "staffMembers", newStaff.id), cleanForFirestore(newStaff)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `staffMembers/${newStaff.id}`)
        );
      }
    }
    setCurrentUser(userProfile);
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("Sign out error:", e);
      }
    }
    localStorage.removeItem("app_current_user");
    setIsAuthModalOpen(true);
  };

  const handleUpdateCurrentUserProfile = (name: string, employeeNumber?: string) => {
    setCurrentUser((prev) => ({
      ...prev,
      name,
      employeeNumber,
    }));

    // Synchronize with Staff Master
    const existingIndex = staffMembers.findIndex(
      (s) => s.email.toLowerCase() === currentUser.email.toLowerCase()
    );
    let targetStaff: StaffMember;
    if (existingIndex >= 0) {
      targetStaff = {
        ...staffMembers[existingIndex],
        name,
        employeeNumber,
      };
      setStaffMembers((prev) => {
        const updated = [...prev];
        updated[existingIndex] = targetStaff;
        return updated;
      });
    } else {
      targetStaff = {
        id: `staff-${Date.now()}`,
        name,
        email: currentUser.email,
        employeeNumber,
      };
      setStaffMembers((prev) => [...prev, targetStaff]);
    }

    if (db) {
      setDoc(doc(db, "staffMembers", targetStaff.id), cleanForFirestore(targetStaff)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `staffMembers/${targetStaff.id}`)
      );
    }
  };

  // Filters state
  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: "",
    airportCode: "",
    urgentOnly: false,
    assignedStaffId: "ALL",
    statusFilter: "all",
  });

  // Sync to local storage as fallback
  useEffect(() => {
    saveLocalStaff(staffMembers);
  }, [staffMembers]);

  useEffect(() => {
    saveLocalQuotes(quotes);
  }, [quotes]);

  useEffect(() => {
    saveLocalMessages(messages);
  }, [messages]);

  // Staff CRUD Handlers
  const handleAddStaff = (newStaffData: Omit<StaffMember, "id">) => {
    const newStaff: StaffMember = {
      ...newStaffData,
      id: `staff-${Date.now()}`,
    };
    setStaffMembers((prev) => [...prev, newStaff]);
    if (db) {
      setDoc(doc(db, "staffMembers", newStaff.id), cleanForFirestore(newStaff)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `staffMembers/${newStaff.id}`)
      );
    }
  };

  const handleUpdateStaff = (updatedStaff: StaffMember) => {
    setStaffMembers((prev) =>
      prev.map((s) => (s.id === updatedStaff.id ? updatedStaff : s))
    );
    if (db) {
      setDoc(doc(db, "staffMembers", updatedStaff.id), cleanForFirestore(updatedStaff)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `staffMembers/${updatedStaff.id}`)
      );
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    setStaffMembers((prev) => prev.filter((s) => s.id !== staffId));
    setQuotes((prev) =>
      prev.map((q) => (q.assignedStaffId === staffId ? { ...q, assignedStaffId: undefined } : q))
    );
    if (db) {
      deleteDoc(doc(db, "staffMembers", staffId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `staffMembers/${staffId}`)
      );
    }
  };

  // Currently selected quote object
  const selectedQuote = useMemo(() => {
    if (!selectedQuoteId) return null;
    return quotes.find((q) => q.id === selectedQuoteId) || null;
  }, [quotes, selectedQuoteId]);

  // Active (non-archived) quotes
  const activeQuotes = useMemo(() => {
    return quotes.filter((q) => !q.isArchived);
  }, [quotes]);

  // Archived quotes
  const archivedQuotes = useMemo(() => {
    return quotes.filter((q) => q.isArchived);
  }, [quotes]);

  // Filtered active quotes based on search query, airport code, and urgent flag
  const filteredQuotes = useMemo(() => {
    return activeQuotes.filter((q) => {
      // Free word search
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase().trim();
        const matchesTitle = q.title.toLowerCase().includes(query);
        const matchesVessel = q.vesselName.toLowerCase().includes(query);
        const matchesAuthor = q.createdBy.toLowerCase().includes(query);
        const matchesAirports = q.airportCodes.some((code) =>
          code.toLowerCase().includes(query)
        );
        const matchesEmailText = q.rawEmailText?.toLowerCase().includes(query);

        if (
          !matchesTitle &&
          !matchesVessel &&
          !matchesAuthor &&
          !matchesAirports &&
          !matchesEmailText
        ) {
          return false;
        }
      }

      // Airport code filter
      if (filters.airportCode) {
        if (!q.airportCodes.includes(filters.airportCode)) {
          return false;
        }
      }

      // Urgent only filter
      if (filters.urgentOnly) {
        if (!q.isUrgent) return false;
      }

      // Assigned staff filter
      if (filters.assignedStaffId && filters.assignedStaffId !== "ALL") {
        if (filters.assignedStaffId === "UNASSIGNED") {
          if (q.assignedStaffId) return false;
        } else {
          if (q.assignedStaffId !== filters.assignedStaffId) return false;
        }
      }

      // Status filter
      if (filters.statusFilter && filters.statusFilter !== "all") {
        if (q.status !== filters.statusFilter) return false;
      }

      return true;
    });
  }, [activeQuotes, filters]);

  // Total unread count for active quotes
  const unreadCount = useMemo(() => {
    return activeQuotes.filter((q) => !q.readBy?.includes(currentUser.email)).length;
  }, [activeQuotes, currentUser.email]);

  // Helper to determine if notification should be dispatched for a status change / task addition / archive event
  const shouldNotifyForQuoteEvent = (
    quote: QuotationItem,
    eventKey: keyof NotificationPreferences["notifyOnStatusChanges"],
    customMessages?: QuoteMessage[]
  ): boolean => {
    if (!notificationPreferences.desktopEnabled) return false;
    const isEventEnabled = Boolean(notificationPreferences.notifyOnStatusChanges[eventKey]);
    if (!isEventEnabled) return false;

    if (notificationPreferences.statusChangeScope === "mentioned_only") {
      const userEmailLower = currentUser.email.toLowerCase();
      const isAssigned =
        quote.assignedStaffId &&
        staffMembers.find((s) => s.id === quote.assignedStaffId)?.email.toLowerCase() === userEmailLower;
      const isCreator = quote.createdBy.toLowerCase() === userEmailLower;

      const msgsToCheck = customMessages || messages.filter((m) => m.quoteId === quote.id);
      const isMentionedInMsgs = msgsToCheck.some((m) =>
        isUserMentioned(m.contentHtml, currentUser, staffMembers)
      );
      const isMentionedInTitle = isUserMentioned(quote.title, currentUser, staffMembers);
      const isMentionedInVessel = isUserMentioned(quote.vesselName, currentUser, staffMembers);

      if (!isAssigned && !isCreator && !isMentionedInMsgs && !isMentionedInTitle && !isMentionedInVessel) {
        return false;
      }
    }

    return true;
  };

  // Archive & Delete Handlers
  const handleArchiveQuote = (quoteId: string) => {
    const target = quotes.find((q) => q.id === quoteId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const archivedQuote: QuotationItem = {
      ...target,
      isArchived: true,
      archivedAt: nowIso,
      updatedAt: nowIso,
    };
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? archivedQuote : q))
    );

    if (shouldNotifyForQuoteEvent(archivedQuote, "archived")) {
      triggerDesktopNotification(
        `📦 [アーカイブ] ${target.vesselName} (${target.title})`,
        `タスクがアーカイブされました (操作者: ${currentUser.name})`,
        `archive-${quoteId}`
      );
    }

    if (db) {
      setDoc(doc(db, "quotations", quoteId), cleanForFirestore(archivedQuote)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `quotations/${quoteId}`)
      );
    }
  };

  const handleRestoreQuote = (quoteId: string) => {
    const target = quotes.find((q) => q.id === quoteId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const restoredQuote: QuotationItem = {
      ...target,
      isArchived: false,
      archivedAt: undefined,
      updatedAt: nowIso,
    };
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? restoredQuote : q))
    );
    if (db) {
      setDoc(doc(db, "quotations", quoteId), cleanForFirestore(restoredQuote)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `quotations/${quoteId}`)
      );
    }
  };

  const handleDeleteQuote = (quoteId: string) => {
    const msgIdsToDelete = messages.filter((m) => m.quoteId === quoteId).map((m) => m.id);
    setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    setMessages((prev) => prev.filter((m) => m.quoteId !== quoteId));
    if (db) {
      deleteDoc(doc(db, "quotations", quoteId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `quotations/${quoteId}`)
      );
      msgIdsToDelete.forEach((mId) => {
        deleteDoc(doc(db, "messages", mId)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `messages/${mId}`)
        );
      });
    }
  };

  const handleDeleteAllArchived = () => {
    const archivedIds = quotes.filter((q) => q.isArchived).map((q) => q.id);
    const msgIdsToDelete = messages.filter((m) => archivedIds.includes(m.quoteId)).map((m) => m.id);
    setQuotes((prev) => prev.filter((q) => !q.isArchived));
    setMessages((prev) => prev.filter((m) => !archivedIds.includes(m.quoteId)));
    if (db) {
      archivedIds.forEach((qId) => {
        deleteDoc(doc(db, "quotations", qId)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `quotations/${qId}`)
        );
      });
      msgIdsToDelete.forEach((mId) => {
        deleteDoc(doc(db, "messages", mId)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `messages/${mId}`)
        );
      });
    }
  };

  // Create Quote directly from an Email message
  const handleCreateQuoteFromEmail = (email: EmailMessage) => {
    const newQuoteId = `quote-${Date.now()}`;
    const cleanTitle =
      email.subject
        .replace(/^(Re:|Fwd:|【緊急見積依頼】|【見積依頼】|【至急確認】)\s*/i, "")
        .trim() || "新規メール見積案件";

    const vessel = email.vesselName || "不明";
    const airport = email.airportCode ? [email.airportCode] : ["SIN"];

    // Weight extraction fallback
    const weightMatch = email.bodyText.match(/(\d+\s*kg)/i);
    const weightStr = weightMatch ? weightMatch[1] : "未指定";

    const nowIso = new Date().toISOString();

    const newQuote: QuotationItem = {
      id: newQuoteId,
      title: cleanTitle,
      vesselName: vessel,
      airportCodes: airport,
      grossWeight: weightStr,
      isUrgent: email.labels?.includes("緊急") || email.subject.includes("緊急"),
      status: "requested",
      createdBy: currentUser.email,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastRepliedAt: nowIso,
      readBy: [currentUser.email],
    };

    const initialMessage: QuoteMessage = {
      id: `msg-${Date.now()}`,
      quoteId: newQuoteId,
      authorEmail: email.fromEmail,
      authorName: email.fromName,
      createdAt: nowIso,
      contentHtml: `<p><strong>【受信メールより自動案件化】</strong></p><p>差出人: ${email.fromName} (${email.fromEmail})</p><p>件名: ${email.subject}</p><hr/><p>${email.bodyText.replace(/\n/g, "<br>")}</p>`,
    };

    setQuotes((prev) => [newQuote, ...prev]);
    setMessages((prev) => [...prev, initialMessage]);
    setSelectedQuoteId(newQuoteId);

    if (shouldNotifyForQuoteEvent(newQuote, "requested", [initialMessage])) {
      triggerDesktopNotification(
        `📥 [新規タスク追加] ${newQuote.vesselName} (${newQuote.title})`,
        `【見積依頼】に新規タスクが追加されました (受信メールより自動作成)`,
        `create-${newQuoteId}`
      );
    }

    if (db) {
      setDoc(doc(db, "quotations", newQuote.id), cleanForFirestore(newQuote)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `quotations/${newQuote.id}`)
      );
      setDoc(doc(db, "messages", initialMessage.id), cleanForFirestore(initialMessage)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `messages/${initialMessage.id}`)
      );
    }

    // Switch view to Kanban to present the newly created quote
    setActiveView("kanban");
  };

  // Create new Quote
  const handleCreateQuote = (
    newQuoteData: Omit<
      QuotationItem,
      "id" | "createdAt" | "updatedAt" | "lastRepliedAt" | "readBy"
    >,
    initialMessageHtml: string
  ) => {
    const newId = `quote-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const createdQuote: QuotationItem = {
      ...newQuoteData,
      id: newId,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastRepliedAt: nowIso,
      readBy: [currentUser.email], // Read by author
    };

    const initialMessage: QuoteMessage = {
      id: `msg-${newId}-1`,
      quoteId: newId,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      createdAt: nowIso,
      contentHtml: initialMessageHtml,
      externalLinks: newQuoteData.externalLinks,
    };

    setQuotes((prev) => [createdQuote, ...prev]);
    setMessages((prev) => [...prev, initialMessage]);
    setSelectedQuoteId(newId);

    // Trigger Desktop Notification for task creation in column if configured
    const initialStatusKey = createdQuote.status as keyof NotificationPreferences["notifyOnStatusChanges"];
    if (shouldNotifyForQuoteEvent(createdQuote, initialStatusKey, [initialMessage])) {
      const colTitle = KANBAN_COLUMNS.find((c) => c.id === createdQuote.status)?.title || createdQuote.status;
      triggerDesktopNotification(
        `📌 [新規タスク追加] ${createdQuote.vesselName} (${createdQuote.title})`,
        `【${colTitle}】に新規タスクが追加されました (作成者: ${currentUser.name})`,
        `create-${newId}`
      );
    }

    // Process mentions: trigger desktop notification and auto-send background email to mentioned staff
    processMentionNotificationsAndEmails({
      contentHtml: initialMessageHtml,
      quote: createdQuote,
      senderName: currentUser.name,
      senderEmail: currentUser.email,
      currentUser,
      staffMembers,
      msgId: initialMessage.id,
    });

    if (db) {
      setDoc(doc(db, "quotations", createdQuote.id), cleanForFirestore(createdQuote)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `quotations/${createdQuote.id}`)
      );
      setDoc(doc(db, "messages", initialMessage.id), cleanForFirestore(initialMessage)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `messages/${initialMessage.id}`)
      );
    }
  };

  // Change quote status
  const handleStatusChange = (quoteId: string, newStatus: QuoteStatus) => {
    const target = quotes.find((q) => q.id === quoteId);
    if (!target || target.status === newStatus) return;

    const oldStatusCol = KANBAN_COLUMNS.find((c) => c.id === target.status);
    const newStatusCol = KANBAN_COLUMNS.find((c) => c.id === newStatus);
    const nowIso = new Date().toISOString();

    // Inline System Log message inserted into thread
    const systemLogMsg: QuoteMessage = {
      id: `syslog-${Date.now()}`,
      quoteId: quoteId,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      createdAt: nowIso,
      contentHtml: `<strong>${currentUser.email}</strong> がステータスを【${
        oldStatusCol?.title || target.status
      }】から【${newStatusCol?.title || newStatus}】に変更しました`,
      isSystemLog: true,
    };

    const updatedQuote: QuotationItem = {
      ...target,
      status: newStatus,
      updatedAt: nowIso,
      readBy: [currentUser.email], // Unread for other users when status changes!
    };

    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? updatedQuote : q))
    );

    // Trigger Desktop Notification based on Notification Preferences
    const statusKey = newStatus as keyof NotificationPreferences["notifyOnStatusChanges"];
    if (shouldNotifyForQuoteEvent(updatedQuote, statusKey)) {
      triggerDesktopNotification(
        `📌 [ステータス変更] ${target.vesselName} (${target.title})`,
        `【${newStatusCol?.title || newStatus}】に変更されました (更新者: ${currentUser.name})`,
        `status-${quoteId}`
      );
    }

    setMessages((prev) => [...prev, systemLogMsg]);

    if (db) {
      setDoc(doc(db, "quotations", quoteId), cleanForFirestore(updatedQuote)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `quotations/${quoteId}`)
      );
      setDoc(doc(db, "messages", systemLogMsg.id), cleanForFirestore(systemLogMsg)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `messages/${systemLogMsg.id}`)
      );
    }
  };

  // Add Reply to Thread
  const handleAddReply = (
    quoteId: string,
    contentHtml: string,
    externalLinks?: ExternalLink[]
  ) => {
    const nowIso = new Date().toISOString();
    const newMsg: QuoteMessage = {
      id: `msg-${Date.now()}`,
      quoteId,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      createdAt: nowIso,
      contentHtml,
      externalLinks,
    };

    setMessages((prev) => [...prev, newMsg]);

    const targetQuote = quotes.find((q) => q.id === quoteId);
    let updatedQuote: QuotationItem | null = null;
    if (targetQuote) {
      updatedQuote = {
        ...targetQuote,
        updatedAt: nowIso,
        lastRepliedAt: nowIso,
        readBy: [currentUser.email], // Unread for other users
      };
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? updatedQuote! : q))
      );
    }

    if (db) {
      setDoc(doc(db, "messages", newMsg.id), cleanForFirestore(newMsg)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `messages/${newMsg.id}`)
      );
      if (updatedQuote) {
        setDoc(doc(db, "quotations", quoteId), cleanForFirestore(updatedQuote)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `quotations/${quoteId}`)
        );
      }
    }

    // Process mentions: trigger desktop notification and auto-send background email to all mentioned staff
    processMentionNotificationsAndEmails({
      contentHtml,
      quote: targetQuote,
      senderName: currentUser.name,
      senderEmail: currentUser.email,
      currentUser,
      staffMembers,
      msgId: newMsg.id,
    });
  };

  // Update existing quote
  const handleUpdateQuote = (updatedQuote: QuotationItem) => {
    setQuotes((prev) =>
      prev.map((q) => (q.id === updatedQuote.id ? updatedQuote : q))
    );
    if (db) {
      setDoc(doc(db, "quotations", updatedQuote.id), cleanForFirestore(updatedQuote)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `quotations/${updatedQuote.id}`)
      );
    }
  };

  // Update existing message content
  const handleUpdateMessage = (
    messageId: string,
    newContentHtml: string,
    newExternalLinks?: ExternalLink[]
  ) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return;
    const updatedMsg: QuoteMessage = {
      ...targetMsg,
      contentHtml: newContentHtml,
      externalLinks: newExternalLinks ?? targetMsg.externalLinks,
    };
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? updatedMsg : msg))
    );
    if (db) {
      setDoc(doc(db, "messages", messageId), cleanForFirestore(updatedMsg)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `messages/${messageId}`)
      );
    }
  };

  // Delete existing message
  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    if (db) {
      deleteDoc(doc(db, "messages", messageId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `messages/${messageId}`)
      );
    }
  };

  // --- Kanban Chat Handlers ---
  const handleSendChatMessage = (content: string, mentions: string[]) => {
    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      authorEmail: currentUser.email,
      authorName: currentUser.name,
      content,
      createdAt: new Date().toISOString(),
      mentions,
      readBy: [currentUser.email],
    };

    setChatMessages((prev) => [...prev, newMsg]);

    if (db) {
      setDoc(doc(db, "chat_messages", newMsg.id), cleanForFirestore(newMsg)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `chat_messages/${newMsg.id}`)
      );
    }
  };

  const handleMarkAllChatRead = () => {
    setChatMessages((prev) => {
      let changed = false;
      const updated = prev.map((msg) => {
        if (!msg.readBy?.includes(currentUser.email)) {
          changed = true;
          const nextReadBy = [...(msg.readBy || []), currentUser.email];
          if (db) {
            setDoc(doc(db, "chat_messages", msg.id), cleanForFirestore({ ...msg, readBy: nextReadBy })).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `chat_messages/${msg.id}`)
            );
          }
          return { ...msg, readBy: nextReadBy };
        }
        return msg;
      });
      return changed ? updated : prev;
    });
  };

  const handleCleanupOldChatMessages = (retentionDays: number) => {
    if (retentionDays <= 0) return;
    const cutoffTime = Date.now() - retentionDays * 86400000;

    setChatMessages((prev) => {
      const remaining: ChatMessage[] = [];
      prev.forEach((msg) => {
        const msgTime = new Date(msg.createdAt).getTime();
        if (!isNaN(msgTime) && msgTime < cutoffTime) {
          if (db) {
            deleteDoc(doc(db, "chat_messages", msg.id)).catch((err) =>
              handleFirestoreError(err, OperationType.DELETE, `chat_messages/${msg.id}`)
            );
          }
        } else {
          remaining.push(msg);
        }
      });
      return remaining;
    });
  };

  const handleDeleteChatMessage = (msgId: string) => {
    setChatMessages((prev) => prev.filter((m) => m.id !== msgId));
    if (db) {
      deleteDoc(doc(db, "chat_messages", msgId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `chat_messages/${msgId}`)
      );
    }
  };

  const handleTypingChatMessage = () => {
    if (!db || !currentUser) return;
    const typingDoc: ChatTypingStatus = {
      email: currentUser.email,
      name: currentUser.name,
      lastTypedAt: Date.now(),
    };
    setDoc(doc(db, "chat_typing", currentUser.email), cleanForFirestore(typingDoc)).catch((err) =>
      console.error("Failed to update typing status:", err)
    );
  };

  // Mark quote as read by current user
  const handleMarkAsRead = (quoteId: string) => {
    const targetQuote = quotes.find((q) => q.id === quoteId);
    if (targetQuote && !targetQuote.readBy?.includes(currentUser.email)) {
      const updatedQuote: QuotationItem = {
        ...targetQuote,
        readBy: [...(targetQuote.readBy || []), currentUser.email],
      };
      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? updatedQuote : q))
      );
      if (db) {
        setDoc(doc(db, "quotations", quoteId), cleanForFirestore(updatedQuote)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `quotations/${quoteId}`)
        );
      }
    }
  };

  // Data Restore / Import JSON
  const handleRestoreData = (
    restoredQuotes: QuotationItem[],
    restoredMessages: QuoteMessage[],
    restoredStaff?: StaffMember[]
  ) => {
    setQuotes(restoredQuotes);
    setMessages(restoredMessages);
    if (restoredStaff) {
      setStaffMembers(restoredStaff);
    }
    if (db) {
      restoredQuotes.forEach((q) => {
        setDoc(doc(db, "quotations", q.id), cleanForFirestore(q)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `quotations/${q.id}`)
        );
      });
      restoredMessages.forEach((m) => {
        setDoc(doc(db, "messages", m.id), cleanForFirestore(m)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `messages/${m.id}`)
        );
      });
      if (restoredStaff) {
        restoredStaff.forEach((s) => {
          setDoc(doc(db, "staffMembers", s.id), cleanForFirestore(s)).catch((err) =>
            handleFirestoreError(err, OperationType.WRITE, `staffMembers/${s.id}`)
          );
        });
      }
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 relative ${
        theme === "light"
          ? "bg-white text-slate-900 font-bold"
          : theme === "cute"
          ? "bg-pink-50 text-pink-950 font-sans"
          : theme === "digital"
          ? "bg-[#020c07] text-emerald-400 font-mono"
          : "bg-slate-900 text-slate-100 font-sans"
      }`}
    >
      {/* Top Navbar */}
      <div className="relative z-50">
        <Navbar
          quotes={activeQuotes}
          messages={messages}
          filters={filters}
          setFilters={setFilters}
          currentUser={currentUser}
          currentTheme={theme}
          activeView={activeView}
          onActiveViewChange={handleSetActiveView}
          staffMembers={staffMembers}
          onThemeChange={setTheme}
          onOpenNewQuoteModal={() => setIsNewQuoteOpen(true)}
          onOpenBackupModal={() => setIsBackupOpen(true)}
          onOpenUserSwitchModal={() => setIsUserSwitchOpen(true)}
          onOpenStaffMasterModal={() => setIsStaffMasterOpen(true)}
          onOpenArchiveModal={() => setIsArchiveOpen(true)}
          onOpenBgSettings={() => setIsBgSettingsOpen(true)}
          onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
          onLogout={handleLogout}
          onSelectQuote={(q) => setSelectedQuoteId(q.id)}
          totalQuotesCount={activeQuotes.length}
          unreadCount={unreadCount}
          archivedQuotesCount={archivedQuotes.length}
        />
      </div>

      {/* Main Canvas Area (Kanban Board OR Backstage Sticky Board) */}
      <main
        className={`flex-1 overflow-hidden relative transition-colors ${
          appBackground.type === "default"
            ? theme === "light"
              ? "bg-[#f0fdf4]"
              : theme === "cute"
              ? "bg-pink-100/40"
              : theme === "digital"
              ? "bg-[#020c07]"
              : "bg-slate-950/80"
            : ""
        }`}
        style={{
          ...(appBackground.type === "color" && appBackground.value
            ? { backgroundColor: appBackground.value }
            : {}),
          ...(appBackground.type === "image" && appBackground.value
            ? {
                backgroundImage: `url("${appBackground.value}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }
            : {}),
        }}
      >
        {/* Background Image Layer directly inside Main Canvas Area */}
        {appBackground.type === "image" && appBackground.value && (
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <img
              src={appBackground.value}
              alt="Main Canvas Wallpaper"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-slate-950/20" />
          </div>
        )}

        <div className="relative z-10 w-full h-full overflow-hidden">
          {activeView === "kanban" ? (
          <>
            <KanbanBoard
              quotes={filteredQuotes}
              messages={messages}
              currentUser={currentUser}
              staffMembers={staffMembers}
              onSelectQuote={(q) => setSelectedQuoteId(q.id)}
              onStatusChange={handleStatusChange}
              onArchiveQuote={handleArchiveQuote}
            />
            <KanbanChatWindow
              currentUser={currentUser}
              staffMembers={staffMembers}
              chatMessages={chatMessages}
              chatTypingUsers={chatTypingUsers}
              onSendMessage={handleSendChatMessage}
              onMarkAllRead={handleMarkAllChatRead}
              onCleanupOldMessages={handleCleanupOldChatMessages}
              onDeleteMessage={handleDeleteChatMessage}
              onTyping={handleTypingChatMessage}
            />
          </>
        ) : activeView === "sticky_board" ? (
          <StickyBoard currentUser={currentUser} currentTheme={theme} />
        ) : (
          <EmailClient
            emails={emails}
            setEmails={handleSetEmails}
            currentUser={currentUser}
            staffMembers={staffMembers}
            quotes={quotes}
            onCreateQuoteFromEmail={handleCreateQuoteFromEmail}
            emailServerSettings={emailServerSettings}
            onUpdateEmailServerSettings={handleUpdateEmailServerSettings}
            currentTheme={theme}
          />
        )}
        </div>
      </main>

      {/* Modals & Drawer */}
      <NewQuoteModal
        isOpen={isNewQuoteOpen}
        onClose={() => setIsNewQuoteOpen(false)}
        currentUser={currentUser}
        staffMembers={staffMembers}
        onCreateQuote={handleCreateQuote}
      />

      <ThreadDrawer
        quote={selectedQuote}
        messages={messages}
        currentUser={currentUser}
        staffMembers={staffMembers}
        onClose={() => setSelectedQuoteId(null)}
        onStatusChange={handleStatusChange}
        onArchiveQuote={handleArchiveQuote}
        onAddReply={handleAddReply}
        onMarkAsRead={handleMarkAsRead}
        onUpdateQuote={handleUpdateQuote}
        onUpdateMessage={handleUpdateMessage}
        onDeleteMessage={handleDeleteMessage}
      />

      <StaffMasterModal
        isOpen={isStaffMasterOpen}
        onClose={() => setIsStaffMasterOpen(false)}
        staffMembers={staffMembers}
        onAddStaff={handleAddStaff}
        onUpdateStaff={handleUpdateStaff}
        onDeleteStaff={handleDeleteStaff}
      />

      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        quotes={quotes}
        messages={messages}
        staffMembers={staffMembers}
        onRestoreData={handleRestoreData}
      />

      <UserSwitchModal
        isOpen={isUserSwitchOpen}
        onClose={() => setIsUserSwitchOpen(false)}
        currentUser={currentUser}
        staffMembers={staffMembers}
        onSelectUser={setCurrentUser}
        onUpdateCurrentUserProfile={handleUpdateCurrentUserProfile}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        staffMembers={staffMembers}
        onLoginSuccess={handleLoginSuccess}
      />

      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        archivedQuotes={archivedQuotes}
        messages={messages}
        staffMembers={staffMembers}
        onDeleteQuote={handleDeleteQuote}
        onDeleteAllArchived={handleDeleteAllArchived}
        onRestoreQuote={handleRestoreQuote}
        onSelectQuote={(q) => {
          setIsArchiveOpen(false);
          setSelectedQuoteId(q.id);
        }}
      />

      <BackgroundSettingsModal
        isOpen={isBgSettingsOpen}
        onClose={() => setIsBgSettingsOpen(false)}
        currentUser={currentUser}
        currentTheme={theme}
        background={appBackground}
        onSave={handleSaveBackground}
      />

      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
        currentUser={currentUser}
        currentTheme={theme}
        preferences={notificationPreferences}
        onSave={handleSaveNotificationPreferences}
      />
    </div>
  );
}
