import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  Building2, 
  MessageSquare, 
  BarChart3, 
  UserCircle, 
  Plus, 
  ThumbsUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  LogOut,
  MapPin,
  Filter,
  CheckCircle,
  Link,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Scale,
  ThumbsDown,
  FileUp,
  Paperclip,
  Upload,
  FileText,
  Download,
  TrendingUp,
  Languages,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  History,
  Lock,
  RefreshCw,
  Users,
  Bell,
  Flame,
  Zap,
  Search,
  Globe,
  Moon,
  Menu,
  Trash2,
  X,
  Key,
  Slash,
  ShieldPlus,
  Activity,
  Edit,
  Settings2,
  Send,
  Eye,
  EyeOff,
  ArrowDown,
  Utensils,
  Home,
  GraduationCap,
  HeartPulse,
  Sun,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { GoogleGenAI } from "@google/genai";
import { University, User, Complaint, Comment, Category, Role } from "./types";
import { cn, formatTimeAgo } from "./lib/utils";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend 
} from "recharts";

// --- Components ---

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className={cn(
      "fixed top-20 right-4 z-[120] px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border min-w-[300px]",
      type === 'success' ? "bg-white text-emerald-700 border-emerald-100" : 
      type === 'info' ? "bg-white text-indigo-700 border-indigo-100" : 
      "bg-red-50 text-red-700 border-red-200"
    )}
  >
    <div className={cn(
      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
      type === 'success' ? "bg-emerald-50" : 
      type === 'info' ? "bg-indigo-50" : 
      "bg-red-100"
    )}>
      {type === 'success' ? <CheckCircle className="w-4 h-4" /> : 
       type === 'info' ? <Bell className="w-4 h-4" /> : 
       <AlertCircle className="w-4 h-4" />}
    </div>
    <div className="flex-1">
      <p className={cn(
        "text-[11px] font-bold leading-tight",
        type === 'success' ? "text-emerald-800" : 
        type === 'info' ? "text-indigo-800" : 
        "text-red-800"
      )}>{message}</p>
    </div>
    <button onClick={onClose} className={cn("p-1 rounded-md transition-colors", type === 'success' ? "hover:bg-emerald-50" : type === 'info' ? "hover:bg-indigo-50" : "hover:bg-red-100")}>
      <X className={cn("w-3.5 h-3.5", type === 'success' ? "text-emerald-400" : type === 'info' ? "text-indigo-400" : "text-red-400")} />
    </button>
  </motion.div>
);

const TrendingBadge = ({ upvotes }: { upvotes: number }) => {
  if (upvotes < 50) return null;
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-100 shadow-sm animate-pulse">
      <Zap className="w-3 h-3 fill-rose-600" />
      Trending Incident
    </span>
  );
}

interface ComplaintCardProps {
  key?: React.Key;
  complaint: Complaint;
  onUpvote?: (id: string) => void;
  userRole: Role;
  user: User;
  onRefresh: () => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, description: string, category: string) => Promise<void>;
  onVisit?: (id: string) => void;
}

const CategoryIcon = ({ cat }: { cat: string }) => {
  const map: Record<string, any> = {
    "CAFETERIA": <Utensils className="w-3 h-3" />,
    "DORMITORY": <Home className="w-3 h-3" />,
    "ACADEMIC": <GraduationCap className="w-3 h-3" />,
    "SAFETY": <ShieldAlert className="w-3 h-3" />,
    "CLINIC": <HeartPulse className="w-3 h-3" />
  };
  return map[cat] || <Filter className="w-3 h-3" />;
};

const ComplaintCard = ({ 
  complaint, 
  onUpvote, 
  userRole,
  user,
  onRefresh,
  onDelete,
  onEdit,
  onVisit
}: ComplaintCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(complaint.description);
  const [editCategory, setEditCategory] = useState(complaint.category);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [commentFile, setCommentFile] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY is not set.");
      return;
    }
    setIsTranslating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Detect the language of this text. If it is English, translate it to Amharic. If it is any other language (like Amharic, Afan Oromo, or Tigrinya), translate it to English. Return ONLY the translated text. Text: "${complaint.description}"`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setTranslatedText(response.text);
    } catch (error) {
      console.error("Translation error:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  const fetchComments = async () => {
    try {
      const url = user ? `/api/complaints/${complaint.id}/comments?current_user_id=${user.id}` : `/api/complaints/${complaint.id}/comments`;
      const res = await fetch(url);
      const data = await res.json();
      setComments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentReaction = async (commentId: string, type: 'LIKE' | 'DISLIKE') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/comments/${commentId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, reactionType: type })
      });
      if (res.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      if (onVisit) onVisit(complaint.id);
      fetchComments();
    }
  }, [isExpanded, onVisit, complaint.id]);

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !commentFile) return;
    
    await fetch(`/api/complaints/${complaint.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        text: newComment,
        isOfficial: user.role === "UNI_ADMIN" || user.role === "MOE",
        evidenceUrl: commentFile
      })
    });
    setNewComment("");
    setCommentFile(null);
    fetchComments();
    onRefresh();
  };

  const submitAdministrativeMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    formData.append("adminId", user.id);
    
    await fetch(`/api/complaints/${complaint.id}/response`, {
      method: "POST",
      body: formData
    });
    setShowResponseForm(false);
    onRefresh();
  };

  const handleComplaintReaction = async (type: 'LIKE' | 'DISLIKE') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, reactionType: type })
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async () => {
    if (!onEdit) return;
    await onEdit(complaint.id, editDescription, editCategory);
    setIsEditing(false);
  };

  const hasEthiopic = /[\u1200-\u137F]/.test(complaint.description);

  return (
    <div className="flex items-end gap-2 lg:gap-3 group/complaint">
      <div className="flex items-center gap-1 LG:gap-2 shrink-0 pb-2">
         <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border border-white shadow-xl bg-white overflow-hidden flex items-center justify-center ring-2 lg:ring-4 ring-slate-100/30 transition-transform group-hover/complaint:scale-110 duration-500">
            {complaint.student_avatar ? (
              <img src={complaint.student_avatar} alt="Author" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-200">
                 <UserCircle className="w-5 h-5 lg:w-7 lg:h-7" />
              </div>
            )}
         </div>
         <div className="hidden sm:block">
            <div className="text-[7px] lg:text-[8px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md leading-none">
               {complaint.poster_role === 'MOE' ? "MOE" : complaint.poster_role === 'UNI_ADMIN' ? "UNI" : "STUD"}
            </div>
         </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex-1 rounded-2xl lg:rounded-[2rem] rounded-bl-none border flex flex-col transition-all overflow-hidden mb-6 lg:mb-8",
          user?.id === complaint.student_id ? "border-indigo-400 border-2 shadow-lg shadow-indigo-100 bg-indigo-50/50" :
          complaint.poster_role === 'MOE' ? "bg-rose-50/30 border-rose-200 shadow-md ring-1 ring-rose-100" :
          complaint.poster_role === 'UNI_ADMIN' ? "bg-indigo-50/30 border-indigo-200 shadow-md ring-1 ring-indigo-100" :
          "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 shadow-indigo-100/10"
        )}
      >
        <div className={cn(
          "p-3 lg:p-4 py-2 lg:py-3 border-b flex flex-wrap items-center justify-between gap-2",
          complaint.poster_role === 'MOE' ? "border-rose-100 bg-rose-50/50" :
          complaint.poster_role === 'UNI_ADMIN' ? "border-indigo-100 bg-indigo-50/50" :
          "border-slate-50 bg-slate-50/30"
        )}>
          <div className="flex items-center gap-2 lg:gap-3">
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-1.5 leading-none">
                <p className={cn(
                  "text-[9px] lg:text-[10px] font-black uppercase tracking-tight flex items-center gap-1",
                  complaint.poster_role === 'MOE' ? "text-rose-600" :
                  complaint.poster_role === 'UNI_ADMIN' ? "text-indigo-600" :
                  "text-slate-800"
                )}>
                  {complaint.poster_role !== 'STUDENT' && <ShieldCheck className="w-2.5 h-2.5 lg:w-3 lg:h-3" />}
                  <span className="truncate max-w-[80px] lg:max-w-none">{complaint.student_name}</span>
                  {complaint.poster_role !== 'STUDENT' && (
                    <span className="text-[6px] lg:text-[7px] font-black uppercase px-1 py-0.5 bg-current text-white rounded-sm ring-1 ring-white/20">
                      Verified
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1 bg-slate-100/50 px-1.5 py-0.5 rounded-full border border-slate-100">
                   <div className="w-3 h-3 lg:w-3.5 lg:h-3.5 rounded-full overflow-hidden border border-white bg-white shrink-0">
                      {complaint.university_logo ? (
                        <img src={complaint.university_logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-slate-200" />
                      )}
                   </div>
                   <span className="text-[7px] lg:text-[8px] font-bold text-slate-500 uppercase tracking-tight truncate max-w-[60px] lg:max-w-[100px]">
                      {complaint.university_name}
                   </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="text-[7px] lg:text-[7.5px] font-black text-slate-400 font-mono tracking-tighter">
                  {formatTimeAgo(complaint.created_at)}
                </div>
                <div className="w-0.5 h-0.5 rounded-full bg-slate-200" />
                <span className={cn(
                  "text-[7px] lg:text-[7.5px] font-black uppercase tracking-[0.1em]",
                  complaint.poster_role === 'MOE' ? "text-rose-400" :
                  complaint.poster_role === 'UNI_ADMIN' ? "text-indigo-400" :
                  "text-slate-400"
                )}>
                  {complaint.poster_role === 'MOE' ? "MoE OFFICIAL" : complaint.poster_role === 'UNI_ADMIN' ? "UNI ADMIN" : "STUDENT REPORT"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 lg:gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100/50 text-[8px] lg:text-[9px] font-black text-indigo-600 uppercase tracking-tight">
              <CategoryIcon cat={complaint.category} />
              <span>{complaint.category}</span>
            </div>
            <TrendingBadge upvotes={complaint.upvotes_count} />
            {user?.id === complaint.student_id && (
              <div className="flex gap-1 ml-2">
                <button 
                  onClick={() => {
                    if (!isEditing) {
                      setEditDescription(complaint.description);
                      setEditCategory(complaint.category);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className={cn(
                    "p-1 rounded transition-colors",
                    isEditing ? "bg-indigo-600 text-white" : "hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                  )}
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => onDelete?.(complaint.id)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

      <div className={cn("p-5 flex flex-col gap-4", isEditing && "bg-indigo-50/30")}>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {["CAFETERIA", "DORMITORY", "ACADEMIC", "SAFETY", "CLINIC"].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setEditCategory(cat)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold transition-all",
                      editCategory === cat ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full p-4 text-sm border-2 border-indigo-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none min-h-[120px] bg-white shadow-inner transition-all"
                placeholder="Update your description..."
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  className="px-5 py-2 text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 transition-all uppercase tracking-widest"
                >
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className={cn(
                "text-sm leading-relaxed mb-4 whitespace-pre-wrap",
                complaint.poster_role !== 'STUDENT' ? "text-slate-900 font-black" : "text-slate-700 font-medium",
                translatedText && "italic text-indigo-900 bg-indigo-50/30 p-2 rounded-lg"
              )}>
                {translatedText || complaint.description}
              </p>

              {translatedText && (
                <div className="mb-4 -mt-2">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest px-2">AI Translation</span>
                </div>
              )}


          <div className="flex gap-4 mb-4">
            <button 
              onClick={async () => {
                if (translatedText) {
                  setTranslatedText(null);
                } else {
                  await handleTranslate();
                }
              }}
              disabled={isTranslating}
              className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase hover:text-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              {isTranslating ? 'Translating...' : (translatedText ? 'Show Original' : `Translate to ${hasEthiopic ? 'English' : 'Amharic'}`)}
            </button>
          </div>

          {complaint.evidence_url && (
            <div className="mb-4 rounded-xl overflow-hidden border border-slate-200">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2">
                <Paperclip className="w-3 h-3 text-slate-500" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Evidence Attachment</span>
              </div>
              <div className="bg-slate-100 flex justify-center items-center">
                {complaint.evidence_url.includes('type=image') ? (
                  <img 
                    src={complaint.evidence_url} 
                    alt="Evidence" 
                    className="max-h-[300px] w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : complaint.evidence_url.includes('type=video') ? (
                  <video 
                    src={complaint.evidence_url} 
                    controls 
                    className="max-h-[300px] w-full"
                  />
                ) : (
                  <div className="p-8 text-center bg-white/50 backdrop-blur-sm">
                    {complaint.evidence_url.includes('type=pdf') ? (
                      <FileText className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                    ) : (
                      <Link className="w-12 h-12 text-indigo-400 mx-auto mb-3" />
                    )}
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Authenticated Attachment</p>
                    <p className="text-sm font-bold text-slate-800 mb-6">
                      {complaint.evidence_url.includes('type=pdf') ? 'Institutional PDF Evidence' : 'Document or external link attached'}
                    </p>
                    <a 
                      href={complaint.evidence_url} 
                      download="evidence"
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 px-6 py-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black text-white hover:bg-slate-800 transition-all uppercase tracking-widest shadow-xl shadow-slate-200"
                    >
                      <Download className="w-4 h-4" />
                      Decrypt & Open
                    </a>
                  </div>
                )}
              </div>
              {(complaint.evidence_url.includes('type=image') || complaint.evidence_url.includes('type=video')) && (
                <div className="p-3 bg-white border-t border-slate-100 flex justify-end">
                  <a 
                    href={complaint.evidence_url} 
                    download="evidence"
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 uppercase hover:text-indigo-700"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Download Original
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-50">
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold">
                 <Eye className="w-3 h-3" />
                 <span>{complaint.views_count || 0}</span>
              </div>
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                <button 
                  onClick={() => handleComplaintReaction('LIKE')}
                  className={cn(
                    "flex items-center gap-1.5 transition-all text-[10px] font-bold uppercase py-1 px-2.5 rounded-md",
                    complaint.user_reaction === 'LIKE' 
                      ? "text-emerald-600 bg-white shadow-sm" 
                      : "text-slate-500 hover:text-emerald-600 disabled:opacity-30"
                  )}
                >
                  <ThumbsUp className={cn("w-3.5 h-3.5", complaint.user_reaction === 'LIKE' && "fill-emerald-600")} />
                  <span>{complaint.likes_count || 0}</span>
                </button>
                <div className="w-px h-3 bg-slate-200 mx-0.5" />
                <button 
                  onClick={() => handleComplaintReaction('DISLIKE')}
                  className={cn(
                    "flex items-center gap-1.5 transition-all text-[10px] font-bold uppercase py-1 px-2.5 rounded-md",
                    complaint.user_reaction === 'DISLIKE' 
                      ? "text-rose-600 bg-white shadow-sm" 
                      : "text-slate-500 hover:text-rose-600 disabled:opacity-30"
                  )}
                >
                  <ThumbsDown className={cn("w-3.5 h-3.5", complaint.user_reaction === 'DISLIKE' && "fill-rose-600")} />
                  <span>{complaint.dislikes_count || 0}</span>
                </button>
              </div>

              <button 
                onClick={() => {
                  if (!isExpanded) onVisit?.(complaint.id);
                  setIsExpanded(!isExpanded);
                }}
                className={cn(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase transition-colors px-2 py-1",
                  isExpanded ? "text-indigo-600 bg-indigo-50 rounded-md" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <MessageCircle className={cn("w-3.5 h-3.5", isExpanded && "fill-indigo-600")} />
                <span>{complaint.comments_count || 0}</span>
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {(userRole === "UNI_ADMIN" || userRole === "DEPT_ADMIN" || userRole === "SYSTEM_ADMIN") && (
                <button 
                  onClick={() => setShowResponseForm(!showResponseForm)}
                  className="text-[10px] font-bold uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5" />
                  {user.role === "DEPT_ADMIN" ? "Write Public Update" : "Strategic Signal Memo"}
                </button>
              )}
            </div>
          </div>
          </>
        )}
        </div>
      </div>

      <AnimatePresence>
        {(isExpanded || showResponseForm) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-slate-50/50 border-t border-slate-100"
          >
            {showResponseForm && (
              <div className="p-6 bg-indigo-50/50 border-b border-indigo-100">
                <h5 className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest mb-4">Institutional Testimony & Strategic Analysis</h5>
                <form onSubmit={submitAdministrativeMemo} className="space-y-4">
                  <textarea 
                    name="responseText"
                    required
                    placeholder="Provide the university's strategic response or collective directive..."
                    className="w-full rounded-xl border-slate-200 text-xs p-3 focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="file"
                        name="evidenceFile"
                        id={`response-upload-${complaint.id}`}
                        className="hidden"
                      />
                      <label 
                        htmlFor={`response-upload-${complaint.id}`}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border border-slate-200 text-[10px] uppercase font-black text-slate-400 bg-white hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attach Strategic Directive
                      </label>
                    </div>
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-900/10 active:scale-95 transition-transform">Publish Strategy</button>
                  </div>
                </form>
              </div>
            )}

            {!showResponseForm && (
              <div className="p-6 space-y-6">
                {comments.filter(c => c.is_official).map(announcement => (
                  <div key={announcement.id} className="bg-indigo-600 border border-indigo-700 rounded-2xl p-5 text-white shadow-xl shadow-indigo-100 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                        <Scale className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">National Strategic Directive</p>
                        <p className="text-[9px] font-bold text-indigo-200">{formatTimeAgo(announcement.created_at)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      {announcement.text}
                    </p>
                    {announcement.evidence_url && (
                      <div className="rounded-xl overflow-hidden border border-white/10 bg-black/10">
                         {announcement.evidence_url.includes('type=image') ? (
                           <img src={announcement.evidence_url} className="w-full max-h-[200px] object-cover" />
                         ) : (
                           <div className="p-3 flex items-center gap-2">
                             <Paperclip className="w-3 h-3 text-indigo-200" />
                             <a href={announcement.evidence_url} className="text-[10px] font-bold underline">Institutional Verification Evidence</a>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                ))}

                <div className="space-y-4">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Community Feedback & Contestation</h5>
                <div className="space-y-4">
                  {comments.map(c => (
                    <div key={c.id} className={cn(
                      "p-3 rounded-xl border relative group flex gap-3",
                      c.is_official ? "bg-indigo-50 border-indigo-100 shadow-sm" : "bg-white border-slate-100 shadow-sm"
                    )}>
                      <div className="shrink-0 pt-0.5">
                         <div className="w-8 h-8 rounded-full overflow-hidden bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                            {c.user_avatar ? (
                              <img src={c.user_avatar} alt="User" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                               <UserCircle className="w-5 h-5 text-slate-300" />
                            )}
                         </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-[9px] font-bold uppercase tracking-wider",
                            c.is_official ? "text-indigo-600 font-black" : "text-slate-500"
                          )}>
                            {c.user_name} {c.is_official && "• OFFICIAL"}
                          </span>
                          <span className="text-[8px] text-slate-400 font-mono tracking-tight">{formatTimeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-normal mb-3 font-medium">{c.text}</p>
                        
                        {c.evidence_url && (
                          <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
                             {c.evidence_url.includes('type=image') ? (
                               <img src={c.evidence_url} className="w-full max-h-[120px] object-cover" />
                             ) : (
                               <a href={c.evidence_url} download="comment-evidence" className="p-3 flex items-center gap-2 text-[9px] font-black uppercase text-indigo-600 bg-slate-50 hover:bg-slate-100 transition-colors">
                                 <Paperclip className="w-3 h-3" /> Attached Asset
                               </a>
                             )}
                          </div>
                        )}

                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => handleCommentReaction(c.id, 'LIKE')}
                            className={cn(
                              "flex items-center gap-1.5 text-[9px] font-black uppercase transition-all px-2 py-1 rounded-lg",
                              c.user_reaction === 'LIKE' ? "text-indigo-600 bg-indigo-50 shadow-sm ring-1 ring-indigo-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <ThumbsUp className={cn("w-3 h-3", c.user_reaction === 'LIKE' && "fill-indigo-600")} />
                            <span>{c.likes_count}</span>
                          </button>
                          <button 
                            onClick={() => handleCommentReaction(c.id, 'DISLIKE')}
                            className={cn(
                              "flex items-center gap-1.5 text-[9px] font-black uppercase transition-all px-2 py-1 rounded-lg",
                              c.user_reaction === 'DISLIKE' ? "text-rose-600 bg-rose-50 shadow-sm ring-1 ring-rose-100" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <ThumbsDown className={cn("w-3 h-3", c.user_reaction === 'DISLIKE' && "fill-rose-600")} />
                            <span>{c.dislikes_count}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={postComment} className="flex flex-col gap-2 pt-2">
                  <input 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={userRole === "STUDENT" ? "Counter-claim or provide more details..." : "Add your comment..."}
                    className="w-full rounded-xl border-slate-200 dark:border-slate-700 text-sm px-4 py-3 focus:ring-indigo-500 shadow-sm bg-white dark:bg-slate-900 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="file" 
                      id={`comment-upload-${complaint.id}`}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setCommentFile(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label 
                      htmlFor={`comment-upload-${complaint.id}`}
                      className={cn(
                        "flex-1 p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase",
                        commentFile ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                      )}
                    >
                      <Paperclip className="w-4 h-4" />
                      {commentFile ? "Evidence Attached" : "Attach File"}
                    </label>
                    <button type="submit" className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold uppercase active:scale-95 transition-transform">Post</button>
                  </div>
                  {commentFile && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold self-start border border-emerald-100">
                       <CheckCircle className="w-3 h-3" /> Evidence Attached
                       <button onClick={() => setCommentFile(null)} className="ml-2 hover:text-rose-500">X</button>
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  </div>
  );
};

// --- Main App ---

export default function App() {
  const [userState, setUserState] = useState<User | null>(() => {
    const cached = localStorage.getItem("complaint_app_user");
    return cached ? JSON.parse(cached) : null;
  });
  
  const setUser = (newUser: User | null) => {
    setUserState(newUser);
  };
  const [user, _setUser] = [userState, setUser];

  useEffect(() => {
    if (user) localStorage.setItem("complaint_app_user", JSON.stringify(user));
    else localStorage.removeItem("complaint_app_user");
  }, [user]);
  const [authMode, setAuthMode] = useState<"LOGIN" | "REGISTER">("LOGIN");
  const [showPassword, setShowPassword] = useState(false);
  const [registerStage, setRegisterStage] = useState<"PHONE" | "OTP" | "DETAILS">("PHONE");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [simulatedOtp, setSimulatedOtp] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  
  const [checkingStudentId, setCheckingStudentId] = useState(false);
  const [preRegisteredStudent, setPreRegisteredStudent] = useState<{
    found: boolean;
    fullName: string;
    universityId: string;
    universityName: string;
  } | null>(null);
  const [verifyStudentError, setVerifyStudentError] = useState<string | null>(null);
  const [registerRole, setRegisterRole] = useState<"STUDENT" | "UNI_ADMIN">("STUDENT");
  const [studentIdInput, setStudentIdInput] = useState("");
  const [targetUniImport, setTargetUniImport] = useState<string>("AUTO");
  const [isUploadingRegistry, setIsUploadingRegistry] = useState(false);
  const [registrySearchQuery, setRegistrySearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"FEED" | "POST" | "ANALYTICS" | "HOTSPOTS" | "SYSTEM" | "DEPT_INTAKE">("FEED");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedUni, setSelectedUni] = useState<string>("");
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [newCountSinceLastVisit, setNewCountSinceLastVisit] = useState(0);
  const [hasScrolledToLastSeen, setHasScrolledToLastSeen] = useState(false);
  const [isPostFormExpanded, setIsPostFormExpanded] = useState(false);
  const [uniUnreadCounts, setUniUnreadCounts] = useState<Record<string, number>>({});
  
  const newComplaintCount: number = (Object.values(uniUnreadCounts) as number[]).reduce((a, b) => a + b, 0);
  
  // Track last seen and new posts
  useEffect(() => {
    if (user && activeTab === 'FEED') {
      const key = selectedUni || "ALL";
      const stored = localStorage.getItem(`lastSeenId_${user.id}_${key}`);
      if (stored) {
        setLastSeenId(stored);
        setHasScrolledToLastSeen(false);
      } else {
        setLastSeenId(null);
      }
    }
  }, [user, activeTab, selectedUni]);

  useEffect(() => {
    if (lastSeenId && complaints.length > 0) {
      const index = complaints.findIndex(c => c.id === lastSeenId);
      if (index > 0) {
        setNewCountSinceLastVisit(index);
      } else {
        setNewCountSinceLastVisit(0);
      }
    } else {
      setNewCountSinceLastVisit(0);
    }
  }, [complaints, lastSeenId]);

  useEffect(() => {
    if (user && activeTab === 'FEED' && complaints.length > 0) {
      const key = selectedUni || "ALL";
      // If no lastSeenId, set it to the newest one on first list load
      if (!localStorage.getItem(`lastSeenId_${user.id}_${key}`)) {
        const newestId = complaints[0].id;
        setLastSeenId(newestId);
        localStorage.setItem(`lastSeenId_${user.id}_${key}`, newestId);
      }
    }
  }, [complaints, activeTab, user, selectedUni]);

  useEffect(() => {
    if (user && activeTab === 'FEED') {
      // Reset scroll flag when entering feed tab
      (window as any).hasScrolledToUnread = false;

      const map = JSON.parse(localStorage.getItem(`lastVisitedMap_${user.id}`) || "{}");
      const key = selectedUni || "ALL";
      map[key] = new Date().toISOString();
      localStorage.setItem(`lastVisitedMap_${user.id}`, JSON.stringify(map));
      
      setUniUnreadCounts(prev => ({ ...prev, [key]: 0 }));
    }
  }, [activeTab, selectedUni, user]);

  useEffect(() => {
    if (user) {
       const fetchCounts = async () => {
         const lastSeenMap = JSON.parse(localStorage.getItem(`lastVisitedMap_${user.id}`) || "{}");
         const res = await fetch(`/api/complaints/unread-counts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lastSeenMap })
         });
         if (res.ok) {
           const counts = await res.json();
           // if currently on FEED, clear the current tab's count right away
           if (activeTab === "FEED") {
             const key = selectedUni || "ALL";
             counts[key] = 0;
           }
           setUniUnreadCounts(counts);
         }
       }
       fetchCounts();
       const interval = setInterval(fetchCounts, 30000); // 30s
       return () => clearInterval(interval);
    }
  }, [user, activeTab, selectedUni]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [pName, setPName] = useState("");
  const [pBio, setPBio] = useState("");
  const [pAvatar, setPAvatar] = useState("");
  const [pAvatarFile, setPAvatarFile] = useState<File | null>(null);
  const [instLogo, setInstLogo] = useState("");
  const [instLogoFile, setInstLogoFile] = useState<File | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [pSettings, setPSettings] = useState<any>({});
  const [profileTab, setProfileTab] = useState<"INFO" | "PRIVACY" | "CONTROLS">("INFO");
  const [darkMode, setDarkMode] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (res.ok) {
        showNotify("Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setIsChangingPassword(false);
      } else {
        const err = await res.json();
        showNotify(err.error || "Failed to update password.", "error");
      }
    } catch (e) {
      showNotify("Failed to update password.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const exportUserData = () => {
    const data = {
      profile: {
        name: user?.full_name,
        username: user?.username,
        role: user?.role
      },
      settings: pSettings,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uniaccord-data-${user?.username}.json`;
    a.click();
    showNotify("Data exported successfully.");
  };

  useEffect(() => {
    if (user) {
      setPName(user.full_name || "");
      setPBio(user.bio || "");
      setPAvatar(user.avatar_url || "");
      setPSettings(user.settings || {});
      
      if (user.role === 'UNI_ADMIN') {
        const uni = universities.find(u => u.id === user.university_id);
        if (uni) setInstLogo(uni.logo_url || "");
      }
    }
  }, [user, universities]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setPAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInstLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setInstLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setInstLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: pName, bio: pBio, avatarUrl: pAvatar })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setIsEditingProfile(false);
        setPAvatarFile(null);
        showNotify("Profile updated successfully.");
      }
    } catch (e) {
      showNotify("Failed to update profile.", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateInstitutionLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'UNI_ADMIN' || !user.university_id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/universities/${user.university_id}/logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: instLogo })
      });
      if (res.ok) {
        const updated = await res.json();
        setUniversities(prev => prev.map(u => u.id === updated.id ? { ...u, logo_url: updated.logo_url } : u));
        showNotify("Institution logo updated.");
        fetchComplaints();
      }
    } catch (e) {
      showNotify("Failed to update logo.", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: any) => {
    if (!user) return;
    console.log("Updating settings to:", newSettings);
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${user.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: newSettings })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setPSettings(updated.settings);
      }
    } catch (e) {
      showNotify("Settings sync failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetUserPassword = async (userId: string) => {
    setModalConfig({
      type: "PROMPT",
      title: "Reset User Password",
      message: "Please enter a new password for this user. They will need to use this to log in next time.",
      placeholder: "Enter new password...",
      confirmLabel: "Save New Password",
      onConfirm: async (newPass) => {
        if (!newPass) {
          showNotify("Password cannot be empty.", "error");
          return;
        }
        try {
          const res = await fetch(`/api/system/users/${userId}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newPassword: newPass })
          });
          if (res.ok) {
            showNotify("Password updated and saved.");
            setModalConfig(null);
          } else {
            showNotify("Failed to reset password.", "error");
          }
        } catch (e) {
          showNotify("Error: Reset failed.", "error");
        }
      }
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("complaint_app_user");
    setIsProfileOpen(false);
    setActiveTab("FEED");
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeDeptHeads, setActiveDeptHeads] = useState<any[]>([]);
  const [systemUnis, setSystemUnis] = useState<any[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [bannedWords, setBannedWords] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [systemCategories, setSystemCategories] = useState<any[]>([]);
  const [moeUsers, setMoeUsers] = useState<any[]>([]);
  const [preRegisteredList, setPreRegisteredList] = useState<any[]>([]);
  const [selectedUniUsers, setSelectedUniUsers] = useState<any[]>([]);
  const [viewingUniId, setViewingUniId] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{
    type: "CONFIRM" | "PROMPT";
    title: string;
    message: string;
    onConfirm: (value?: string) => void;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  } | null>(null);

  const [newWord, setNewWord] = useState("");
  const [newMoeName, setNewMoeName] = useState("");
  const [newMoeUser, setNewMoeUser] = useState("");
  const [newMoePass, setNewMoePass] = useState("");
  const [provisionedCreds, setProvisionedCreds] = useState<any | null>(null);
  const [newUniName, setNewUniName] = useState("");
  const [newUniLocation, setNewUniLocation] = useState("");
  const [newUniAdminName, setNewUniAdminName] = useState("");
  const [newUniAdminUser, setNewUniAdminUser] = useState("");
  const [newUniAdminPass, setNewUniAdminPass] = useState("");
  const [govSubTab, setGovSubTab] = useState<"DASHBOARD" | "TENANTS" | "USERS" | "POLICIES" | "AUDIT" | "STUDENT_REGISTRY">("DASHBOARD");

  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptUser, setNewDeptUser] = useState("");
  const [newDeptPass, setNewDeptPass] = useState("");
  const [newDeptCat, setNewDeptCat] = useState("");

  const fetchDeptHeads = async () => {
    if (user?.role !== "UNI_ADMIN") return;
    try {
      const res = await fetch(`/api/university/${user.university_id}/department-heads`);
      const data = await res.json();
      setActiveDeptHeads(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    if (fetchNotificationsRef.current) return;
    fetchNotificationsRef.current = true;
    if (user?.role !== "DEPT_ADMIN" && user?.role !== "UNI_ADMIN") {
        fetchNotificationsRef.current = false;
        return;
    }
    try {
      const res = await fetch(`/api/notifications/${user.id}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    } finally {
      fetchNotificationsRef.current = false;
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/system/categories");
      const data = await res.json();
      setSystemCategories(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (user?.role === "UNI_ADMIN") {
      fetchDeptHeads();
      fetchNotifications();
    }
    if (user?.role === "DEPT_ADMIN") fetchNotifications();
  }, [user, activeTab]);

  const createDeptHead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/university/${user.university_id}/department-heads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newDeptName,
          username: newDeptUser,
          password: newDeptPass,
          category: newDeptCat
        })
      });
      if (res.ok) {
        setNewDeptName("");
        setNewDeptUser("");
        setNewDeptPass("");
        setNewDeptCat("");
        fetchDeptHeads();
        showNotify("Departmental sub-account provisioned.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMoeUsers = async () => {
    try {
      const res = await fetch("/api/system/moe-users");
      const data = await res.json();
      setMoeUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const createMoeAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/system/moe-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: newMoeName, username: newMoeUser, password: newMoePass })
      });
      if (res.ok) {
        setNewMoeName("");
        setNewMoeUser("");
        setNewMoePass("");
        fetchMoeUsers();
        showNotify("Ministry account created successfully.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUniUsers = async (uniId: string) => {
    setViewingUniId(uniId);
    setGovSubTab("USERS");
    try {
      const res = await fetch(`/api/system/universities/${uniId}/users`);
      const data = await res.json();
      setSelectedUniUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUserAccount = async (userId: string) => {
    setModalConfig({
      type: "CONFIRM",
      title: "Delete User Account",
      message: "Are you sure you want to delete this account? This will remove all their access to the system.",
      confirmLabel: "Permanently Delete",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/system/users/${userId}`, { method: "DELETE" });
          if (res.ok) {
            setSelectedUniUsers(prev => prev.filter(u => u.id !== userId));
            fetchSystemData();
            showNotify("Account deleted.");
          }
        } catch (e) {
          showNotify("Deletion failed.");
        } finally {
          setModalConfig(null);
        }
      }
    });
  };

  const provisionInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/system/universities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newUniName, 
          location: newUniLocation,
          adminName: newUniAdminName,
          adminUser: newUniAdminUser,
          adminPass: newUniAdminPass
        })
      });
      const data = await res.json();
      if (res.ok) {
        setProvisionedCreds(data.credentials);
        setNewUniName("");
        setNewUniLocation("");
        fetchSystemData();
        showNotify("Autonomous Tenant Provisioned Successfully.");
      } else {
        showNotify(data.error || "Provisioning failed", "error");
      }
    } finally {
      setLoading(false);
    }
  };
  const [initialVisited, setInitialVisited] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`visitedComplaints_${user.id}`);
      if (stored) {
        setInitialVisited(new Set(JSON.parse(stored)));
      }
    }
  }, [user, activeTab]);

  const handleVisit = useCallback(async (id: string) => {
    if (!user) return;
    const stored = localStorage.getItem(`visitedComplaints_${user.id}`);
    const set = new Set<string>(stored ? JSON.parse(stored) : []);
    if (!set.has(id)) {
      set.add(id);
      localStorage.setItem(`visitedComplaints_${user.id}`, JSON.stringify(Array.from(set)));
      const response = await fetch(`/api/complaints/${id}/view`, { method: 'POST', body: JSON.stringify({ userId: user.id }), headers: { 'Content-Type': 'application/json' } });
      const data = await response.json();
      if (data.success) {
        setComplaints(prev => prev.map(c => c.id === id ? { ...c, views_count: data.views_count } : c));
      }
    }
    
    // Also track as last seen for session continuity
    const key = selectedUni || "ALL";
    const currentIndex = complaints.findIndex(c => c.id === id);
    const lastSeenIndex = complaints.findIndex(c => c.id === lastSeenId);
    
    if (currentIndex > -1 && (lastSeenIndex === -1 || currentIndex < lastSeenIndex)) {
      setLastSeenId(id);
      localStorage.setItem(`lastSeenId_${user.id}_${key}`, id);
    }
  }, [user, selectedUni, complaints, lastSeenId]);

  useEffect(() => {
    if (activeTab === 'FEED' && complaints.length > 0 && user) {
      const scrollContainer = scrollContainerRef.current;
      if (!scrollContainer) return;

      const key = selectedUni || "ALL";
      const storedLastSeenId = localStorage.getItem(`lastSeenId_${user.id}_${key}`);

      // If we haven't jumped in this session transition
      if (!(window as any).hasInitialJumped) {
        if (storedLastSeenId) {
          const performJump = () => {
             const el = document.getElementById(`complaint-${storedLastSeenId}`);
             if (el) {
               el.scrollIntoView({ behavior: 'auto', block: 'center' });
               setHasScrolledToLastSeen(true);
             }
          };

          // Double requestAnimationFrame ensures we wait for the browser to perform layout and paint
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              performJump();
              // Small delay as fallback for late renders
              setTimeout(performJump, 100);
            });
          });
        }
        (window as any).hasInitialJumped = true;
      }
    }
  }, [activeTab, complaints.length, user, selectedUni]);

  // Sidebar jump-to-active logic
  useEffect(() => {
    if (selectedUni && sidebarScrollRef.current) {
      const activeEl = document.getElementById(`side-uni-${selectedUni}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedUni]);

  // Reset the jump flag when switching tabs away and back
  useEffect(() => {
    if (activeTab !== 'FEED') {
      (window as any).hasInitialJumped = false;
    }
  }, [activeTab]);

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
    setShowScrollBottom(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const fetchComplaintsRef = useRef(false);
  const fetchNotificationsRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);

  useEffect(() => {
    if (evidenceFile && evidenceFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setEvidencePreview(reader.result as string);
      reader.readAsDataURL(evidenceFile);
    } else {
      setEvidencePreview(null);
    }
  }, [evidenceFile]);

  const showNotify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteComplaint = async (complaintId: string) => {
    if (!user) return;
    setModalConfig({
      type: "CONFIRM",
      title: "Delete Report",
      message: "Are you sure you want to delete this report? This action cannot be undone.",
      confirmLabel: "Delete Report",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/complaints/${complaintId}?userId=${user.id}`, { method: "DELETE" });
          if (res.ok) {
            showNotify("Report deleted", "success");
            fetchComplaints();
          } else {
            const data = await res.json();
            showNotify(data.error || "Failed to delete", "error");
          }
        } catch (err) {
          showNotify("Error deleting", "error");
        } finally {
          setModalConfig(null);
        }
      }
    });
  };

  const handleEditComplaint = async (complaintId: string, description: string, category: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, description, category })
      });
      if (res.ok) {
        showNotify("Report updated successfully", "success");
        fetchComplaints();
      } else {
        const data = await res.json();
        showNotify(data.error || "Failed to update", "error");
      }
    } catch (err) {
      showNotify("Error updating report", "error");
    }
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const data = await res.json();
      if (res.ok) {
        setAuthSuccess("Access granted! Session initialized securely.");
        showNotify("Session Initialized Securely");
        setTimeout(() => {
          setUser(data);
        }, 1000);
      } else {
        setAuthError(data.error || "Authentication failed. Check your username and password.");
        showNotify(data.error || "Login failed", "error");
      }
    } catch (err) {
      setAuthError("Failed to connect to authorization server.");
      showNotify("Connection Error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const phoneInput = formData.get("phone") as string;
    const emailInput = formData.get("email") as string;
    const identifier = phoneInput || emailInput;
    
    setLoading(true);
    setSimulatedOtp(null);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneInput, email: emailInput }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhone(phoneInput);
        setEmail(emailInput);
        setRegisterStage("OTP");
        if (data.simulated && data.code) {
          setSimulatedOtp(data.code);
          showNotify(`Transmitted! (Simulated Code: ${data.code})`);
        } else {
          showNotify(data.message || "Verification code transmitted");
        }
      } else {
        setAuthError(data.error || "Failed to send verification code.");
        showNotify(data.error || "Transmission failed", "error");
      }
    } catch {
      setAuthError("Failed to request verification code.");
      showNotify("Failed to request verification code", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: phone || email, otp: formData.get("otp") }),
      });
      if (res.ok) {
        setRegisterStage("DETAILS");
        showNotify("Verification successful");
      } else {
        const data = await res.json();
        setAuthError(data.error || "Invalid or expired verification code.");
        showNotify(data.error || "Invalid verification code", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyStudentId = async (studentId: string) => {
    if (!studentId.trim()) return;
    setCheckingStudentId(true);
    setVerifyStudentError(null);
    setAuthError(null);
    try {
      const res = await fetch(`/api/auth/verify-student-id?studentId=${encodeURIComponent(studentId.trim())}`);
      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          setPreRegisteredStudent(data);
          showNotify("Match found in the national pre-registration registry!");
        } else {
          setPreRegisteredStudent({ found: false, fullName: "", universityId: "", universityName: "" });
          setVerifyStudentError("Student ID not found in pre-registration records. Contact administrator.");
        }
      } else {
        setVerifyStudentError("Failed to communicate with authorization server.");
      }
    } catch {
      setVerifyStudentError("Failed to communicate with authorization server.");
    } finally {
      setCheckingStudentId(false);
    }
  };

  const handleCompleteRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);
    
    if (registerRole === "STUDENT" && (!preRegisteredStudent || !preRegisteredStudent.found)) {
      setAuthError("Please verify your pre-registered Student ID first.");
      showNotify("Please verify your pre-registered Student ID first.", "error");
      return;
    }

    setLoading(true);
    setAuthError(null);
    setAuthSuccess(null);
    try {
      const payload = registerRole === "STUDENT" 
        ? { 
            ...data, 
            phone,
            email,
            role: "STUDENT", 
            fullName: preRegisteredStudent?.fullName, 
            universityId: preRegisteredStudent?.universityId, 
            studentId: studentIdInput 
          } 
        : { 
            ...data, 
            phone,
            email,
            role: "UNI_ADMIN"
          };

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const userData = await res.json();
      if (res.ok) {
        setAuthSuccess("Registration completed successfully! Welcome to UniAccord!");
        showNotify("Registration complete. Welcome.");
        setTimeout(() => {
          setUser(userData);
        }, 1200);
      } else {
        setAuthError(userData.error || "Registration encountered an error. Please try again.");
        showNotify(userData.error || "Registration failed", "error");
      }
    } catch {
      setAuthError("Connection error during registration. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemData = async () => {
    if (user?.role !== "SYSTEM_ADMIN") return;
    try {
      const results = await Promise.all([
        fetch("/api/system/universities"),
        fetch("/api/system/audit-logs"),
        fetch("/api/system/banned-words"),
        fetch("/api/system/users"),
        fetch("/api/system/categories"),
        fetch("/api/system/moe-users"),
        fetch("/api/system/pre-registered-students")
      ]);

      const data = await Promise.all(results.map(async (r) => {
        if (!r.ok) {
           let errorMsg = `Failed with status ${r.status}`;
           try {
             const errorData = await r.json();
             errorMsg = errorData.message || errorData.error || errorMsg;
           } catch {
             errorMsg = await r.text();
           }
           throw new Error(errorMsg);
        }
        return r.json();
      }));

      setSystemUnis(data[0]);
      setSystemLogs(data[1]);
      setBannedWords(data[2]);
      setSystemUsers(data[3]);
      setSystemCategories(data[4]);
      setMoeUsers(data[5]);
      setPreRegisteredList(data[6]);
    } catch (e) { 
      console.error("System data fetch error:", e); 
    }
  };

  const toggleUniFreeze = async (id: string, current: boolean) => {
    await fetch(`/api/system/universities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_frozen: !current })
    });
    fetchSystemData();
    showNotify("University access updated.");
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingRegistry(true);
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        if (!bstr) throw new Error("Could not read file data");
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Match columns intelligently
        const parsedStudents = rawRows.map(row => {
          // Normalize row keys to lowercase for matching
          const cleanRow: Record<string, any> = {};
          Object.keys(row).forEach(key => {
            cleanRow[key.toLowerCase().trim().replace(/[\s_-]+/g, "")] = row[key];
          });
          
          const fullName = cleanRow.fullname || cleanRow.name || cleanRow.studentname || cleanRow.studentfullname || row["Full Name"] || row["Name"] || "";
          const studentId = cleanRow.studentid || cleanRow.id || cleanRow.studentnumber || cleanRow.idnumber || row["Student ID"] || row["ID Number"] || "";
          
          return {
            full_name: String(fullName).trim(),
            student_id: String(studentId).trim(),
            university_id: targetUniImport
          };
        }).filter(s => s.full_name && s.student_id);

        if (parsedStudents.length === 0) {
          showNotify("No valid student rows found. Ensure file contains 'Student ID' and 'Full Name' columns.", "error");
          return;
        }

        // Send to backend bulk endpoint
        const res = await fetch("/api/system/pre-registered-students/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: parsedStudents }),
        });
        
        if (res.ok) {
          const result = await res.json();
          showNotify(`Registry uploaded! Inserted ${result.insertedCount} new / updated ${result.updatedCount} records.`);
          fetchSystemData();
        } else {
          showNotify("Failed to upload student list.", "error");
        }
      } catch (err) {
        console.error(err);
        showNotify("Error reading Excel spreadsheet.", "error");
      } finally {
        setIsUploadingRegistry(false);
        // Reset file input target
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const deletePreRegisteredStudent = async (id: string) => {
    if (!confirm("Are you sure you want to remove this pre-registered student record?")) return;
    try {
      const res = await fetch(`/api/system/pre-registered-students/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showNotify("Record deleted successfully.");
        fetchPreRegisteredList();
      } else {
        showNotify("Failed to delete record.", "error");
      }
    } catch {
      showNotify("Error connecting to server.", "error");
    }
  };

  const fetchPreRegisteredList = async () => {
    try {
      const res = await fetch("/api/system/pre-registered-students");
      if (res.ok) {
        const data = await res.json();
        setPreRegisteredList(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addBannedWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    await fetch("/api/system/banned-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: newWord })
    });
    setNewWord("");
    fetchSystemData();
    showNotify("Word list updated.");
  };

  const [newCatName, setNewCatName] = useState("");
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !newCatLabel.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/system/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName, label: newCatLabel, description: newCatDesc })
      });
      if (res.ok) {
        setNewCatName("");
        setNewCatLabel("");
        setNewCatDesc("");
        fetchSystemData();
        showNotify("Report category added.");
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Are you sure? This may affect existing reports in this category.")) return;
    try {
      const res = await fetch(`/api/system/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSystemData();
        showNotify("Category removed.");
      }
    } catch (e) {
      showNotify("Failed to delete category", "error");
    }
  };

  const deleteBannedWord = async (id: string) => {
    await fetch(`/api/system/banned-words/${id}`, { method: "DELETE" });
    fetchSystemData();
  };

  const updateUserStatus = async (id: string, status: string) => {
    await fetch(`/api/system/users/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_status: status })
    });
    fetchSystemData();
    showNotify(`User identity status: ${status}`);
  };

  // Fetch initial data
  useEffect(() => {
    if (user?.role === "SYSTEM_ADMIN") fetchSystemData();
  }, [user]);

  useEffect(() => {
    fetch("/api/universities")
      .then(async r => {
        if (!r.ok) {
          let errorMsg = `Failed with status ${r.status}`;
          try {
            const errorData = await r.json();
            errorMsg = errorData.message || errorData.error || errorMsg;
          } catch {
            errorMsg = await r.text();
          }
          throw new Error(errorMsg);
        }
        return r.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setUniversities(data);
          setConfigError(null);
        } else {
          setUniversities([]);
        }
      })
      .catch(err => {
        const isTransient = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError");
        if (isTransient) {
          console.warn("Transient connection error during universities fetch:", err);
        } else {
          console.error("Failed to fetch universities:", err);
          setConfigError("Database connection failed. Ensure DATABASE_URL is set correctly in Settings > Secrets.");
        }
        setUniversities([]);
      });
  }, []);



  useEffect(() => {
    fetchComplaints();
    // If user has an invalid ID from a previous session, force logout to prevent 500s
    if (user && user.id === "admin-id") {
      setUser(null);
    }
    
    if (user) {
      fetchNotifications();
      const interval = setInterval(() => {
        fetchNotifications();
        fetchComplaints();
      }, 20000); // 20s polling for real-time feel
      
      // Continuous Strategic Monitoring
      if (user) {
        fetchNotifications();
        const interval = setInterval(() => {
          fetchNotifications();
          fetchComplaints();
        }, 20000); 
        
        return () => clearInterval(interval);
      }
    }
  }, [selectedUni, user]);

  const fetchComplaints = async () => {
    if (fetchComplaintsRef.current) return; // Already fetching
    fetchComplaintsRef.current = true;
    
    const isMoe = selectedUni === "MOE_TAB";
    const baseUrl = (selectedUni && !isMoe) ? `/api/complaints?university_id=${selectedUni}` : "/api/complaints";
    const char = baseUrl.includes('?') ? '&' : '?';
    // Ensure we only pass the ID if it's not a legacy string
    const requesterId = user && user.id !== "admin-id" ? user.id : "";
    let url = requesterId ? `${baseUrl}${char}current_user_id=${requesterId}` : baseUrl;
    if (isMoe) {
      url += (url.includes('?') ? '&' : '?') + 'role=MOE';
    }
    
    try {
      const res = await fetch(url);
      if (!res.ok) {
           let errorMsg = `Failed with status ${res.status}`;
           try {
             const errorData = await res.json();
             errorMsg = errorData.message || errorData.error || errorMsg;
           } catch {
             errorMsg = await res.text();
           }
           throw new Error(errorMsg);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setComplaints(data);
      } else {
        console.warn("Unexpected format for complaints:", data);
      }
    } catch (err: any) {
      const isTransient = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError");
      if (isTransient) {
        console.warn("Transient connection event during complaints fetch:", err);
      } else {
        console.error("Failed to fetch complaints:", err);
      }
      // Wait to clear array, to avoid empty feed on network error/loading
    } finally {
      fetchComplaintsRef.current = false;
    }
  };

  const submitComplaint = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    // Add file and user info to FormData
    formData.append("studentId", user.id);
    formData.append("universityId", user.university_id || "");
    if (evidenceFile) {
      formData.append("evidenceFile", evidenceFile);
    }
    
    try {
      const res = await fetch("/api/complaints", {
        method: "POST",
        body: formData, // Sending as FormData resolves 413 Payload Too Large
      });
      
      const data = await res.json();
      if (res.ok) {
        fetchComplaints();
        setEvidenceFile(null);
        (e.target as HTMLFormElement).reset();
        const ta = document.getElementById("post-description-input");
        if (ta) ta.style.height = 'auto';
        setActiveTab("FEED");
        showNotify("Intelligence Signal Authorized & Transmitted to MoE Feed");
      } else {
        showNotify(data.error || "Transmission failed", "error");
      }
    } catch (err) {
      showNotify("Network protocols interrupted", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpvote = async (id: string) => {
    if (!user) return;
    const res = await fetch(`/api/complaints/${id}/upvote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    
    if (res.ok) {
      showNotify("Endorsement Registered");
      fetchComplaints();
    } else {
      const data = await res.json();
      showNotify(data.error || "Endorsement failed", "error");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 selection:bg-cyan-500 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-10"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-white/70 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-2xl shadow-cyan-200/50 border border-white/50 w-full max-w-sm relative z-10"
        >
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-cyan-500/20 rotate-3">
              <Scale className="w-7 h-7 text-white -rotate-3" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {authMode === "LOGIN" ? "Welcome back" : "Join UniAccord"}
            </h1>
            <p className="text-slate-600 text-sm mt-2">
              {authMode === "LOGIN" ? "Access to campus governance" : "Contribute to a transparent environment"}
            </p>
          </div>

          <div className="flex gap-1 p-1 bg-white/50 rounded-2xl mb-8 border border-white/50 shadow-inner">
            <button 
              onClick={() => {
                setAuthMode("LOGIN");
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className={cn("flex-1 py-2.5 text-xs font-bold rounded-xl transition-all", authMode === "LOGIN" ? "bg-white text-cyan-700 shadow-sm border border-cyan-100" : "text-slate-500 hover:text-slate-900")}
            >
              Log in
            </button>
            <button 
              onClick={() => { 
                setAuthMode("REGISTER"); 
                setRegisterStage("PHONE"); 
                setAuthError(null);
                setAuthSuccess(null);
              }}
              className={cn("flex-1 py-2.5 text-xs font-bold rounded-xl transition-all", authMode === "REGISTER" ? "bg-white text-cyan-700 shadow-sm border border-cyan-100" : "text-slate-500 hover:text-slate-900")}
            >
              Sign up
            </button>
          </div>

          {/* Inline alert boxes for Login & Registration actions */}
          {(authError || authSuccess) && (
            <div className="space-y-3 mb-6">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-bold flex items-start gap-2.5 shadow-sm"
                >
                  <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[9px] mt-0.5">✕</div>
                  <div className="flex-1 leading-normal">{authError}</div>
                </motion.div>
              )}

              {authSuccess && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-bold flex items-start gap-2.5 shadow-sm"
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold flex-shrink-0 text-[9px] mt-0.5">✓</div>
                  <div className="flex-1 leading-normal">{authSuccess}</div>
                </motion.div>
              )}
            </div>
          )}

          {authMode === "LOGIN" ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-widest ml-1">Username</label>
                <input 
                  name="username" 
                  placeholder="e.g. abebe.k" 
                  required 
                  className="w-full rounded-xl bg-white border-cyan-100 text-slate-900 py-3 px-4 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-widest ml-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    name="password" 
                    placeholder="••••••••" 
                    required 
                    className="w-full rounded-xl bg-white border-cyan-100 text-slate-900 py-3 px-4 pr-11 text-sm focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all placeholder:text-slate-400"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button 
                disabled={loading}
                type="submit"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-500/20 mt-4 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Access Portal"}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {registerStage === "PHONE" && (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <p className="text-xs text-slate-500 leading-relaxed text-center px-2">Registering requires a valid mobile number for secure identification.</p>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Phone Number (Optional)</label>
                    <input 
                      name="phone" 
                      placeholder="+251 9... or 09..." 
                      className="w-full rounded-xl bg-slate-50 border-slate-200 text-slate-900 py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Email (Optional)</label>
                    <input 
                      name="email" 
                      placeholder="student@university.edu" 
                      type="email"
                      className="w-full rounded-xl bg-slate-50 border-slate-200 text-slate-900 py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                  </div>
                  <button 
                    disabled={loading}
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all mt-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify identity"}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center leading-tight">By continuing, you participate in the national standard for campus accountability.</p>
                </form>
              )}

              {registerStage === "OTP" && (
                <form onSubmit={handleVerifyOtp} className="space-y-6">
                  <div className="space-y-1.5 text-center">
                    <label className="block text-xs font-bold text-slate-600">Verification code sent to {phone}</label>
                    <input 
                      name="otp" 
                      placeholder="000000" 
                      required 
                      maxLength={6}
                      className="w-full text-center tracking-[0.5em] rounded-2xl bg-indigo-50 border-indigo-100 text-indigo-600 font-mono py-4 text-2xl font-black focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {simulatedOtp && (
                      <div className="mt-4 text-[11px] font-semibold bg-indigo-50 border border-indigo-100/60 rounded-xl p-2.5 text-indigo-950 text-center">
                        <span className="block text-[9px] font-extrabold uppercase tracking-widest text-indigo-600 mb-0.5">📟 Sandbox SMS Simulation Mode</span>
                        Verification code is <strong className="font-mono bg-white px-1.5 py-0.5 border border-indigo-200 rounded text-indigo-700 font-black text-xs">{simulatedOtp}</strong>
                        <p className="text-[9px] text-slate-400 mt-1 font-medium italic">Configure real Twilio/Infobip credentials to route actual carrier SMS.</p>
                      </div>
                    )}
                  </div>
                  <button 
                    disabled={loading}
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-100 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verify Identity"}
                  </button>
                  <button onClick={() => setRegisterStage("PHONE")} className="w-full text-slate-400 text-[10px] font-bold hover:text-slate-900 transition-colors uppercase tracking-widest">Edit Phone Number</button>
                </form>
              )}

              {registerStage === "DETAILS" && (
                <form onSubmit={handleCompleteRegistration} className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-1 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100/50 text-center">
                    <p className="text-xs text-indigo-950 font-extrabold tracking-tight">University Enrollment Verification</p>
                    <p className="text-[10px] text-slate-500 font-medium">Your credentials will automatically link to your assigned university campus database.</p>
                  </div>

                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Student ID (e.g. DDU-..., AAU-..., UOG-...)</label>
                      <div className="flex gap-2">
                        <input 
                          value={studentIdInput} 
                          onChange={(e) => setStudentIdInput(e.target.value)}
                          placeholder="Enter your Student ID" 
                          disabled={preRegisteredStudent?.found}
                          className="flex-1 rounded-xl bg-white border border-slate-200 text-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 font-mono font-bold" 
                        />
                        {!preRegisteredStudent?.found ? (
                          <button 
                            type="button"
                            onClick={() => handleVerifyStudentId(studentIdInput)}
                            disabled={checkingStudentId || !studentIdInput.trim()}
                            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[90px]"
                          >
                            {checkingStudentId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Verify ID"}
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => {
                              setPreRegisteredStudent(null);
                              setVerifyStudentError(null);
                            }}
                            className="px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {verifyStudentError && (
                      <p className="text-xs text-rose-600 font-semibold p-2 bg-rose-50 rounded-lg border border-rose-100">{verifyStudentError}</p>
                    )}

                    {preRegisteredStudent?.found && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-3 p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-xs"
                      >
                        <p className="font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Registry Record Match Found</p>
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1.5 border-t border-emerald-100/50">
                          <div>
                            <span className="text-emerald-700 block text-[9px] uppercase font-bold tracking-wider">Full Legal Name</span>
                            <span className="font-bold text-slate-950">{preRegisteredStudent.fullName}</span>
                          </div>
                          <div>
                            <span className="text-emerald-700 block text-[9px] uppercase font-bold tracking-wider">Institution Campus</span>
                            <span className="font-bold text-slate-950">{preRegisteredStudent.universityName}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Interactively revealed Username / Password setup fields */}
                  {preRegisteredStudent?.found ? (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-2"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Choose Username</label>
                          <input 
                            name="username" 
                            required 
                            placeholder="e.g. abebe.k" 
                            className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider ml-1">Password</label>
                          <div className="relative">
                            <input 
                              type={showPassword ? "text" : "password"}
                              name="password" 
                              required 
                              placeholder="Min 6 characters"
                              className="w-full rounded-xl bg-slate-50 border border-slate-200 text-slate-900 py-3 px-4 pr-11 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                            />
                            <button 
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button 
                        disabled={loading}
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-slate-900/10 mt-4 text-sm flex items-center justify-center gap-2"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Complete Registration"}
                      </button>
                    </motion.div>
                  ) : (
                    <div className="p-4 border border-dashed border-slate-200 bg-slate-50/30 rounded-2xl text-center py-6">
                      <Lock className="w-5 h-5 text-slate-300 mx-auto mb-2" />
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Awaiting Student ID Verification</p>
                      <p className="text-[9px] text-slate-400 font-bold max-w-[210px] mx-auto mt-1 leading-normal">
                        Your account's security configuration inputs will unlock once your student ID registration ledger is verified.
                      </p>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </motion.div>
      </div>
  );
}

  return (
    <div className="h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 flex flex-col font-sans selection:bg-cyan-500 selection:text-white overflow-hidden">
      <div className="fixed inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_30%,transparent_100%)] opacity-5 pointer-events-none"></div>
      <AnimatePresence>
        {notification && (
          <Toast 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalConfig && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalConfig(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">{modalConfig.title}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">{modalConfig.message}</p>
                
                {modalConfig.type === "PROMPT" && (
                  <div className="mb-6">
                    <input 
                      id="modal-prompt-input"
                      autoFocus
                      placeholder={modalConfig.placeholder}
                      className="w-full rounded-xl border-slate-200 text-sm py-3 px-4 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all shadow-inner font-mono"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          modalConfig.onConfirm((e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => setModalConfig(null)}
                    className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all uppercase tracking-widest"
                  >
                    {modalConfig.cancelLabel || "Abort Request"}
                  </button>
                  <button 
                    onClick={() => {
                      if (modalConfig.type === "PROMPT") {
                        const val = (document.getElementById("modal-prompt-input") as HTMLInputElement)?.value;
                        modalConfig.onConfirm(val);
                      } else {
                        modalConfig.onConfirm();
                      }
                    }}
                    className={cn(
                      "flex-1 py-3 text-xs font-bold text-white rounded-xl transition-all uppercase tracking-widest shadow-lg",
                      modalConfig.title.toLowerCase().includes("delete") || modalConfig.title.toLowerCase().includes("purge") 
                        ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" 
                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                    )}
                  >
                    {modalConfig.confirmLabel || "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileOpen && user && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsProfileOpen(false); setIsEditingProfile(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={cn(
                "w-full max-w-lg lg:rounded-[2rem] shadow-2xl relative z-10 overflow-hidden border h-full lg:h-auto lg:max-h-[85vh]",
                darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-white"
              )}
            >
              <div className="p-4 lg:p-8 h-full overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start mb-4 lg:mb-6">
                  <div className="flex-1 min-w-0">
                    <h2 className={cn("text-lg lg:text-xl font-black tracking-tight", darkMode ? "text-white" : "text-slate-900")}>Account Settings</h2>
                    <div className="flex gap-3 lg:gap-4 mt-3 overflow-x-auto pb-1 no-scrollbar">
                       {["INFO", "PRIVACY", "CONTROLS", ...(user.role === 'UNI_ADMIN' ? ["INSTITUTION"] : [])].map(t => (
                         <button 
                           key={t}
                           onClick={() => setProfileTab(t as any)}
                           className={cn(
                             "text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] transition-all pb-1 border-b-2 shrink-0",
                             profileTab === t ? "text-indigo-600 border-indigo-600" : (darkMode ? "text-slate-500 border-transparent hover:text-slate-400" : "text-slate-400 border-transparent hover:text-slate-600")
                           )}
                         >
                           {t}
                         </button>
                       ))}
                    </div>
                  </div>
                  <button onClick={() => { setIsProfileOpen(false); setIsEditingProfile(false); }} className={cn("p-2 rounded-xl transition-all shrink-0 ml-2", darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100")}>
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {profileTab === "INFO" && (
                  <>
                    {isEditingProfile ? (
                      <form onSubmit={updateProfile} className="space-y-6">
                        <div className="space-y-4">
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 ml-1 leading-none">Display Name</label>
                            <input value={pName} onChange={e => setPName(e.target.value)} className={cn("w-full rounded-xl border text-sm py-3 px-4 transition-all outline-none", darkMode ? "bg-slate-800 border-slate-700 text-white focus:bg-slate-700" : "bg-slate-50 border-slate-200 focus:bg-white focus:ring-indigo-500")} placeholder="Full name..." required />
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 ml-1 leading-none">Profile Picture</label>
                            <div className="flex items-center gap-4">
                              <div className={cn("w-16 h-16 rounded-2xl border overflow-hidden shrink-0 flex items-center justify-center shadow-inner", darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200")}>
                                {pAvatar ? (
                                  <img src={pAvatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <UserCircle className="w-8 h-8 text-slate-300" />
                                )}
                              </div>
                              <label className="flex-1 cursor-pointer group/upload">
                                <div className={cn("w-full py-4 px-4 border-2 border-dashed rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-center transition-all", darkMode ? "bg-slate-800 border-slate-700 text-slate-500 group-hover:border-indigo-500 group-hover:text-indigo-400" : "bg-slate-50 border-slate-200 text-slate-500 group-hover:border-indigo-400 group-hover:bg-indigo-50/30 group-hover:text-indigo-600")}>
                                  {pAvatarFile ? pAvatarFile.name : "Select from computer"}
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5 ml-1 leading-none">Bio</label>
                            <textarea value={pBio} onChange={e => setPBio(e.target.value)} className={cn("w-full rounded-xl border text-sm py-3 px-4 transition-all outline-none min-h-[100px]", darkMode ? "bg-slate-800 border-slate-700 text-white focus:bg-slate-700" : "bg-slate-50 border-slate-200 focus:bg-white focus:ring-indigo-500")} placeholder="A short bio about yourself..." />
                          </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                           <button type="button" onClick={() => setIsEditingProfile(false)} className={cn("flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", darkMode ? "bg-slate-800 text-slate-400 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>Cancel</button>
                           <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100/10">Save Changes</button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-8">
                        <div className={cn("flex items-center gap-6 p-6 rounded-[1.5rem] border transition-colors", darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100")}>
                          <div className={cn("w-20 h-20 rounded-full border overflow-hidden shadow-sm flex items-center justify-center shrink-0", darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}>
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserCircle className="w-10 h-10 text-slate-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn("text-lg font-black leading-tight truncate", darkMode ? "text-white" : "text-slate-900")}>{user.full_name}</p>
                              {(user.role === 'MOE' || user.role === 'UNI_ADMIN') && (
                                <div className={cn(
                                  "px-2 py-0.5 rounded-full flex items-center gap-1",
                                  user.role === 'MOE' ? "bg-rose-100 text-rose-600" : "bg-indigo-100 text-indigo-600"
                                )}>
                                  <ShieldCheck className="w-3 h-3" />
                                  <span className="text-[8px] font-black uppercase tracking-widest">Verified</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-1">@{user.username || "user"}</p>
                            <div className="mt-3 inline-flex py-1 px-2 bg-indigo-600/10 text-indigo-700 rounded-md text-[8px] font-black uppercase tracking-wider">
                              {user.role.replace("_", " ")}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6">
                           <div>
                             <p className="text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-widest">About</p>
                             <div className={cn("text-sm leading-relaxed p-4 rounded-2xl border min-h-[60px]", darkMode ? "bg-slate-800/30 border-slate-800 text-slate-400" : "bg-slate-50/50 border-slate-100 text-slate-600")}>
                               {user.bio || <span className="text-slate-300 italic text-xs">No bio added yet...</span>}
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4">
                              <div className={cn("p-4 rounded-2xl border shadow-sm", darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                 <p className="text-[10px] uppercase text-slate-400 font-black mb-1.5">Identifier</p>
                                 <p className={cn("text-[11px] font-mono font-bold truncate", darkMode ? "text-slate-300" : "text-slate-900")}>{user.student_id_number || "---"}</p>
                              </div>
                              <div className={cn("p-4 rounded-2xl border shadow-sm", darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100")}>
                                 <p className="text-[10px] uppercase text-slate-400 font-black mb-1.5">Contact</p>
                                 <p className={cn("text-[11px] font-bold truncate", darkMode ? "text-slate-300" : "text-slate-900")}>{user.phone || "None"}</p>
                              </div>
                           </div>
                        </div>

                        <button 
                          onClick={() => setIsEditingProfile(true)}
                          className={cn("w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2", darkMode ? "bg-white text-slate-900 hover:bg-slate-100" : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200")}
                        >
                          <Settings2 className="w-3 h-3" />
                          Edit Profile Info
                        </button>
                      </div>
                    )}
                  </>
                )}

                {profileTab === "PRIVACY" && (
                  <div className="space-y-6">
                    <div className={cn("p-6 rounded-[1.5rem] border", darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100")}>
                      <h3 className={cn("text-xs font-black uppercase mb-4", darkMode ? "text-white" : "text-slate-900")}>Privacy Settings</h3>
                      <div className="flex items-center justify-between">
                        <div>
                           <p className={cn("text-sm font-bold", darkMode ? "text-white" : "text-slate-800")}>Hide Identity</p>
                           <p className="text-xs text-slate-500">Display as "Anonymous" to others.</p>
                        </div>
                        <button
                          disabled={loading}
                          onClick={() => updateSettings({ ...pSettings, hideIdentity: !pSettings.hideIdentity })}
                          className={cn(
                             "w-12 h-6 flex items-center rounded-full p-1 transition-all",
                             loading ? "opacity-50 cursor-not-allowed" : "",
                             pSettings.hideIdentity ? "bg-indigo-600 justify-end" : "bg-slate-200 justify-start"
                          )}
                        >
                           <div className={cn("w-4 h-4 rounded-full bg-white shadow-sm transition-transform", loading ? "animate-pulse" : "")} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {profileTab === ("INSTITUTION" as any) && user.role === 'UNI_ADMIN' && (
                  <div className="space-y-6">
                    <form onSubmit={updateInstitutionLogo} className="space-y-6">
                      <div className={cn("p-6 rounded-[1.5rem] border", darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100")}>
                         <h3 className={cn("text-xs font-black uppercase mb-4", darkMode ? "text-white" : "text-slate-900")}>Institution Identity</h3>
                         <div className="flex items-center gap-6">
                            <div className={cn("w-24 h-24 rounded-3xl border overflow-hidden shadow-sm flex items-center justify-center shrink-0", darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200")}>
                               {instLogo ? (
                                 <img src={instLogo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                               ) : (
                                 <Building2 className="w-10 h-10 text-slate-300" />
                               )}
                            </div>
                            <div className="flex-1">
                               <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1.5", darkMode ? "text-slate-400" : "text-slate-500")}>Official University Logo</p>
                               <label className="cursor-pointer group/logo">
                                 <div className={cn("w-full py-3 px-4 border-2 border-dashed rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-all", darkMode ? "bg-slate-900 border-slate-700 text-slate-500 group-hover:border-indigo-500 group-hover:text-indigo-400" : "bg-white border-slate-200 text-slate-400 group-hover:border-indigo-400 group-hover:text-indigo-600")}>
                                   {instLogoFile ? instLogoFile.name : "Choose Logo"}
                                 </div>
                                 <input type="file" className="hidden" accept="image/*" onChange={handleInstLogoChange} />
                               </label>
                            </div>
                         </div>
                      </div>
                      
                      <div className={cn("p-6 rounded-[1.5rem] border", darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100")}>
                         <h3 className={cn("text-xs font-black uppercase mb-2", darkMode ? "text-white" : "text-slate-800")}>Tenant Information</h3>
                         <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-slate-100/50">
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</span>
                               <span className={cn("text-xs font-bold", darkMode ? "text-slate-200" : "text-slate-700")}>{universities.find(u => u.id === user.university_id)?.name}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-slate-100/50">
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</span>
                               <span className="text-[10px] font-mono text-slate-400">{user.university_id}</span>
                            </div>
                         </div>
                      </div>

                      <button 
                        disabled={loading || !instLogoFile}
                        type="submit"
                        className={cn(
                          "w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2",
                          !instLogoFile ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100/20"
                        )}
                      >
                        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Update Institution Logo
                      </button>
                    </form>
                  </div>
                )}

                {profileTab === "PRIVACY" && (
                  <div className="space-y-6">
                    <div className={cn("p-6 rounded-[1.5rem] border space-y-6", darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100")}>
                       <div className="flex items-center justify-between">
                          <div>
                             <p className={cn("text-xs font-black uppercase", darkMode ? "text-white" : "text-slate-900")}>Stealth Mode</p>
                             <p className="text-[10px] text-slate-400 font-bold mt-0.5">Hide your name from public reports</p>
                          </div>
                          <button 
                             onClick={() => updateSettings({ ...pSettings, hideIdentity: !pSettings.hideIdentity })}
                             className={cn(
                                "w-10 h-5 rounded-full transition-all relative flex items-center px-1",
                                pSettings.hideIdentity ? "bg-indigo-600" : (darkMode ? "bg-slate-700" : "bg-slate-300")
                             )}
                          >
                             <div className={cn(
                                "w-3 h-3 bg-white rounded-full transition-all",
                                pSettings.hideIdentity ? "translate-x-5" : "translate-x-0"
                             )} />
                          </button>
                       </div>
                    </div>

                    <div className={cn("p-6 rounded-[1.5rem] border", darkMode ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100")}>
                       <h3 className={cn("text-xs font-black uppercase mb-4", darkMode ? "text-white" : "text-slate-900")}>Security</h3>
                       {isChangingPassword ? (
                         <form onSubmit={handlePasswordChange} className="space-y-4">
                           <div>
                             <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block tracking-widest pl-1">Current Password</label>
                             <div className="relative">
                               <input 
                                 type={showPassword ? "text" : "password"}
                                 value={currentPassword}
                                 onChange={e => setCurrentPassword(e.target.value)}
                                 required
                                 className={cn("w-full rounded-xl border text-xs py-2.5 px-4 outline-none", darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200")}
                               />
                             </div>
                           </div>
                           <div>
                             <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block tracking-widest pl-1">New Password</label>
                             <div className="relative">
                               <input 
                                 type={showPassword ? "text" : "password"}
                                 value={newPassword}
                                 onChange={e => setNewPassword(e.target.value)}
                                 required
                                 className={cn("w-full rounded-xl border text-xs py-2.5 px-4 outline-none", darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-slate-200")}
                               />
                               <button 
                                 type="button"
                                 onClick={() => setShowPassword(!showPassword)}
                                 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                               >
                                 {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                               </button>
                             </div>
                           </div>
                           <div className="flex gap-2 pt-2">
                             <button 
                               type="button" 
                               onClick={() => { setIsChangingPassword(false); setCurrentPassword(""); setNewPassword(""); }}
                               className={cn("flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest", darkMode ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-600")}
                             >
                               Cancel
                             </button>
                             <button 
                               type="submit"
                               className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest"
                             >
                               Confirm
                             </button>
                           </div>
                         </form>
                       ) : (
                         <button 
                           onClick={() => setIsChangingPassword(true)}
                           className={cn("w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left group", darkMode ? "bg-slate-900 border-slate-700 hover:border-indigo-500" : "bg-white border-slate-200 hover:border-indigo-400")}
                         >
                            <div className="flex items-center gap-3">
                               <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                               <span className={cn("text-[10px] font-bold uppercase tracking-widest", darkMode ? "text-slate-300" : "text-slate-700")}>Update Account Password</span>
                            </div>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                         </button>
                       )}
                    </div>
                    
                    <div className={cn("p-4 border rounded-2xl flex gap-3", darkMode ? "bg-amber-900/20 border-amber-900/30" : "bg-amber-50 border-amber-100")}>
                       <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                       <div>
                          <p className={cn("text-[9px] font-black uppercase mb-0.5", darkMode ? "text-amber-500" : "text-amber-900")}>Data Protection</p>
                          <p className={cn("text-[10px] leading-relaxed font-medium", darkMode ? "text-amber-200/60" : "text-amber-700")}>Your data is encrypted following MoE standards. Reporting anonymously still allows officials to contact you through your ID if required for evidence.</p>
                       </div>
                    </div>
                  </div>
                )}

                {profileTab === "CONTROLS" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => setDarkMode(!darkMode)}
                         className={cn(
                           "flex flex-col items-start p-4 rounded-2xl border transition-all text-left",
                           darkMode ? "bg-slate-800 border-slate-700" : "border-slate-100 hover:bg-slate-50"
                         )}
                       >
                          <Moon className={cn("w-5 h-5 mb-3", darkMode ? "text-indigo-400" : "text-slate-900")} />
                          <p className={cn("text-xs font-black uppercase", darkMode ? "text-white" : "text-slate-900")}>Dark Mode</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">{darkMode ? "Enabled" : "Disabled"}</p>
                       </button>
                       <button className="flex flex-col items-start p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all text-left">
                          <Bell className="w-5 h-5 text-slate-900 mb-3" />
                          <p className="text-xs font-black text-slate-900 uppercase">Alerts</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">Push Only</p>
                       </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                       <button 
                         onClick={exportUserData}
                         className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 group transition-all"
                       >
                          <div className="flex items-center gap-3">
                             <Globe className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                             <p className="text-xs font-black text-slate-900 uppercase group-hover:text-indigo-900">Export All My Data</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                       </button>
                       
                       <button 
                         onClick={() => {
                            setModalConfig({
                               type: "CONFIRM",
                               title: "Purge Search History",
                               message: "This will permanently clear your interaction history and local search cache.",
                               onConfirm: () => { showNotify("History purged."); setModalConfig(null); }
                            });
                         }}
                         className="w-full flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-rose-50 hover:border-rose-100 group transition-all mt-2"
                       >
                          <div className="flex items-center gap-3">
                             <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
                             <p className="text-xs font-black text-slate-900 uppercase group-hover:text-rose-900">Clear Local Storage</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                       </button>
                    </div>

                    <div className="pt-2">
                       <button 
                         onClick={logout}
                         className="w-full flex items-center justify-between p-4 rounded-2xl border border-rose-100 bg-rose-50/30 hover:bg-rose-50 transition-all"
                       >
                          <div className="flex items-center gap-3">
                             <LogOut className="w-4 h-4 text-rose-600" />
                             <p className="text-xs font-black text-rose-900 uppercase">Terminate Session</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-rose-300" />
                       </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header: UniAccord Navigation */}
      <header className={cn(
        "h-16 border-b flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-50 transition-colors",
        darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="flex items-center gap-2 lg:gap-3">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-500"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-600 rounded-lg lg:rounded-xl flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-100 text-white">
            <Scale className="w-4 h-4 lg:w-5 lg:h-5" />
          </div>
          <div className="hidden sm:block">
            <h1 className={cn("text-base lg:text-lg font-black tracking-tight leading-none", darkMode ? "text-white" : "text-slate-900")}>UniAccord</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
               <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-[7px] lg:text-[8px] font-black uppercase tracking-widest text-slate-400">Secure • Connected</p>
            </div>
          </div>
        </div>

        <div className={cn(
          "hidden sm:flex items-center gap-1 p-1 rounded-xl border transition-colors overflow-x-auto no-scrollbar max-w-none",
          darkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
        )}>
          <NavButton 
            active={activeTab === "FEED"} 
            onClick={() => setActiveTab("FEED")} 
            icon={<MessageSquare className="w-4 h-4" />} 
            label="Feed" 
            badge={newComplaintCount > 0 ? newComplaintCount : undefined}
          />
          {(user.role === "DEPT_ADMIN" || user.role === "UNI_ADMIN") && (
            <NavButton 
              active={activeTab === "DEPT_INTAKE"} 
              onClick={() => setActiveTab("DEPT_INTAKE")} 
              icon={<Bell className="w-4 h-4" />} 
              label="Insights" 
              badge={notifications.filter(n => n.is_read === false).length}
            />
          )}
          {(user.role === "MOE" || user.role === "SYSTEM_ADMIN" || user.role === "UNI_ADMIN") && (
            <NavButton 
              active={activeTab === "ANALYTICS"} 
              onClick={() => setActiveTab("ANALYTICS")} 
              icon={<BarChart3 className="w-4 h-4" />} 
              label="Strategic Data" 
            />
          )}
          {(user.role === "UNI_ADMIN" || user.role === "DEPT_ADMIN" || user.role === "MOE" || user.role === "SYSTEM_ADMIN") && (
            <NavButton 
              active={activeTab === "HOTSPOTS"} 
              onClick={() => setActiveTab("HOTSPOTS")} 
              icon={<Flame className="w-4 h-4" />} 
              label="Hotspots" 
            />
          )}
          {(user.role === "SYSTEM_ADMIN" || user.role === "UNI_ADMIN") && (
            <NavButton 
              active={activeTab === "SYSTEM"} 
              onClick={() => setActiveTab("SYSTEM")} 
              icon={<Lock className="w-4 h-4" />} 
              label="Policy & Gov" 
            />
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden xl:flex gap-6 border-l border-slate-200 pl-6">
            <div>
              <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Reports</p>
              <p className="text-xs font-bold text-slate-900 tracking-tight">{complaints.length}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Impact</p>
              <p className="text-xs font-bold text-indigo-600 tracking-tight">
                {complaints.reduce((acc, c) => acc + (c.upvotes_count || 0), 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn(
              "text-right hidden lg:block border-l pl-6 transition-colors",
              darkMode ? "border-slate-800" : "border-slate-200"
            )}>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.role.replace("_", " ")}</p>
               <p className="text-xs font-black tracking-tight">{user.full_name}</p>
            </div>
            <button 
              onClick={logout} 
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-xl transition-all border",
                darkMode ? "bg-slate-800 text-slate-400 hover:text-rose-400 border-slate-700" : "bg-slate-50 text-slate-400 hover:text-rose-600 border-slate-200"
              )}
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {configError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-600 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4"
            >
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold leading-tight">{configError}</p>
                <p className="text-[10px] mt-1 opacity-80 uppercase tracking-widest font-semibold">MoE Technical Alert</p>
              </div>
            </motion.div>
          </div>
        )}
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[55] lg:hidden"
            />
          )}
        </AnimatePresence>

        {/* Sidebar: University Navigation */}
        <nav className={cn(
          "fixed lg:relative border-r flex flex-col shrink-0 transition-all duration-300 h-full z-[60] lg:z-40 shadow-2xl lg:shadow-none",
          isSidebarOpen ? "w-3/5 translate-x-0 lg:w-72" : "w-20 -translate-x-full lg:translate-x-0",
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          {/* Sidebar Toggle Button (Desktop) */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex absolute top-5 -right-3 z-[70] w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all hover:scale-110 text-slate-400 hover:text-indigo-600"
          >
            {isSidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          <div 
            ref={sidebarScrollRef}
            className={cn("p-6 flex-1 flex flex-col gap-6 transition-all duration-300 overflow-y-auto custom-scrollbar", !isSidebarOpen && "px-3 items-center")}
          >
            {/* Mobile Navigation Links */}
            <div className="lg:hidden space-y-1 bg-slate-50 p-2 rounded-2xl mb-4">
              <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2 ml-2">Navigation</h2>
              <button 
                onClick={() => { setActiveTab("FEED"); setIsSidebarOpen(false); }}
                className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest", activeTab === "FEED" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500")}
              >
                <MessageSquare className="w-4 h-4" /> Feed
              </button>
              {(user.role === "DEPT_ADMIN" || user.role === "UNI_ADMIN") && (
                <button 
                  onClick={() => { setActiveTab("DEPT_INTAKE"); setIsSidebarOpen(false); }}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest", activeTab === "DEPT_INTAKE" ? "bg-white shadow-sm text-indigo-600" : "text-slate-500")}
                >
                  <Bell className="w-4 h-4" /> Strategic Insights
                </button>
              )}
              {(user.role === "MOE" || user.role === "SYSTEM_ADMIN" || user.role === "UNI_ADMIN") && (
                <button 
                  onClick={() => { setActiveTab("ANALYTICS"); setIsSidebarOpen(false); }}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest", activeTab === "ANALYTICS" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600" : "text-slate-500 dark:text-slate-400")}
                >
                  <BarChart3 className="w-4 h-4" /> National Analytics
                </button>
              )}
              {(user.role === "UNI_ADMIN" || user.role === "DEPT_ADMIN" || user.role === "MOE" || user.role === "SYSTEM_ADMIN") && (
                <button 
                  onClick={() => { setActiveTab("HOTSPOTS"); setIsSidebarOpen(false); }}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest", activeTab === "HOTSPOTS" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600" : "text-slate-500 dark:text-slate-400")}
                >
                  <Flame className="w-4 h-4" /> Strategic Hotspots
                </button>
              )}
              {(user.role === "SYSTEM_ADMIN" || user.role === "UNI_ADMIN") && (
                <button 
                  onClick={() => { setActiveTab("SYSTEM"); setIsSidebarOpen(false); }}
                  className={cn("w-full flex items-center gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest", activeTab === "SYSTEM" ? "bg-white dark:bg-slate-800 shadow-sm text-indigo-600" : "text-slate-500 dark:text-slate-400")}
                >
                  <Lock className="w-4 h-4" /> Protocol Governance
                </button>
              )}
              {user.role === "STUDENT" && (
                <button 
                  onClick={() => { setIsPostFormExpanded(true); setIsSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                >
                  <Plus className="w-4 h-4" /> Report Incident
                </button>
              )}
            </div>
            {/* National Strategic Section */}
            <div className="w-full shrink-0">
               <h2 className={cn("text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 ml-2 transition-opacity", !isSidebarOpen && "opacity-0 h-0 overflow-hidden")}>National Intelligence</h2>
               <div className="space-y-1">
                 <button 
                   onClick={() => setSelectedUni("")}
                   className={cn(
                     "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left group",
                     selectedUni === "" 
                       ? "bg-indigo-50 text-indigo-700 font-bold shadow-sm ring-1 ring-indigo-200" 
                       : "hover:bg-slate-50 text-slate-600 font-medium",
                     !isSidebarOpen && "justify-center px-0 h-10 w-10 mx-auto"
                   )}
                   title="All Institutions"
                 >
                   <div className="flex items-center gap-3">
                     <div className={cn(
                       "w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-transform",
                       selectedUni === "" ? "bg-indigo-600 text-white scale-110" : "bg-slate-100 text-slate-400"
                     )}>
                       <Globe className="w-4 h-4" />
                     </div>
                     <span className={cn("text-xs transition-opacity duration-300", !isSidebarOpen && "opacity-0 invisible hidden")}>National Feed</span>
                   </div>
                   {selectedUni === "" && isSidebarOpen && <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />}
                 </button>
               </div>
            </div>

            {/* Educational Institutions */}
            <div className="w-full shrink-0">
               <h2 className={cn("text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-3 mt-4 ml-2 transition-opacity", !isSidebarOpen && "opacity-0 h-0 overflow-hidden")}>Institutions</h2>
               <div className="space-y-1">
                 {universities.map((uni, idx) => (
                    <button 
                      key={uni.id}
                      onClick={() => { setSelectedUni(uni.id); setUniUnreadCounts(prev => ({...prev, [uni.id]: 0})); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all text-left group",
                        selectedUni === uni.id 
                          ? "bg-indigo-50 dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 font-bold shadow-sm ring-1 ring-indigo-200 dark:ring-slate-700" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium",
                        !isSidebarOpen && "justify-center px-0 h-10 w-10 mx-auto"
                      )}
                      title={uni.name}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className={cn(
                            "w-8 h-8 rounded-full overflow-hidden border bg-white flex items-center justify-center transition-all",
                            selectedUni === uni.id ? "border-indigo-200 dark:border-slate-600 shadow-sm scale-110" : "border-slate-100 dark:border-slate-800 grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100"
                          )}>
                            {uni.logo_url ? (
                              <img src={uni.logo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-xs uppercase">
                                {uni.name ? uni.name.charAt(0) : '?'}
                              </div>
                            )}
                          </div>
                          {/* Notification Badge */}
                          {uniUnreadCounts[uni.id] > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white dark:border-slate-900 shadow-sm z-10">
                              {uniUnreadCounts[uni.id]}
                            </span>
                          )}
                        </div>
                        <span className={cn("text-xs transition-opacity duration-300 truncate", !isSidebarOpen && "opacity-0 invisible hidden")}>{uni.name}</span>
                      </div>
                      {selectedUni === uni.id && isSidebarOpen && <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />}
                    </button>
                 ))}
               </div>
            </div>
          </div>
          
          <div className={cn("p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 transition-all relative shrink-0", !isSidebarOpen && "px-3 items-center")}>
            {/* Settings Menu Trigger */}
            <button 
              onClick={() => {
                setIsSettingsMenuOpen(!isSettingsMenuOpen);
                if (!isSettingsMenuOpen) {
                  setUniUnreadCounts({});
                }
              }}
              className={cn(
                "w-full flex items-center justify-between p-2 rounded-xl transition-all group hover:bg-slate-200 dark:hover:bg-slate-800",
                isSettingsMenuOpen && "bg-slate-200 dark:bg-slate-800"
              )}
            >
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 relative">
                <Settings className="w-5 h-5" />
                {newComplaintCount > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {newComplaintCount}
                  </span>
                )}
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", !isSidebarOpen && "hidden")}>Settings</span>
              </div>
            </button>

            {/* Settings Popover */}
            {isSettingsMenuOpen && (
              <div className={cn("absolute bottom-full left-0 mb-2 w-72 border rounded-2xl shadow-2xl p-4 z-[90]", 
                darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              )}>
                {/* Profile Section */}
                <div className="flex items-center gap-3 mb-6 p-2 rounded-xl">
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white flex items-center justify-center shrink-0 shadow-sm">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserCircle className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col items-start leading-none min-w-0">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate w-full">{user?.full_name}</span>
                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold truncate w-full">{user?.role.replace("_", " ")}</span>
                  </div>
                </div>

                {/* Profile & Settings Buttons */}
                <button
                  onClick={() => { setIsProfileOpen(true); setProfileTab("INFO"); setIsSettingsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 p-3 mb-2 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase"
                >
                  <UserCircle className="w-5 h-5" />
                  My Profile
                </button>
                <button
                  onClick={() => { setIsProfileOpen(true); setProfileTab("CONTROLS"); setIsSettingsMenuOpen(false); }}
                  className="w-full flex items-center gap-2 p-3 mb-4 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase"
                >
                  <Settings2 className="w-5 h-5" />
                  Account Settings
                </button>

                {/* Dark Mode Toggle */}
                <button 
                  onClick={() => setDarkMode(!darkMode)} 
                  className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                >
                  <div className="flex items-center gap-2">
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider">{darkMode ? "Light Mode" : "Dark Mode"}</span>
                  </div>
                  <div className={cn("w-8 h-4 rounded-full relative transition-colors", darkMode ? "bg-indigo-600" : "bg-slate-300")}>
                    <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", darkMode ? "left-4.5" : "left-0.5")} style={{ left: darkMode ? "18px": "2px" }} />
                  </div>
                </button>
              </div>
            )}
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {activeTab === "FEED" && (
            <div className="flex-1 h-full flex flex-col relative overflow-hidden bg-slate-50/30">
              {/* Independent Scroll for Main Content */}
                <div 
                  ref={scrollContainerRef} 
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto relative pt-4 custom-scrollbar"
                >
                  <AnimatePresence>
                    {newCountSinceLastVisit > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -20, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: -20, x: '-50%' }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 z-[60]"
                      >
                         <button 
                           onClick={() => {
                             scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
                             if (complaints[0]) {
                               const newestId = complaints[0].id;
                               setLastSeenId(newestId);
                               localStorage.setItem(`lastSeenId_${user?.id}_${selectedUni || "ALL"}`, newestId);
                               setNewCountSinceLastVisit(0);
                             }
                           }}
                           className="bg-indigo-600 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-indigo-300 ring-4 ring-white flex items-center gap-3 hover:bg-slate-900 transition-all group pointer-events-auto"
                         >
                            <TrendingUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform text-indigo-200" />
                            Show {newCountSinceLastVisit} New Reports
                         </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <AnimatePresence>
                    {showScrollBottom && (
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        onClick={scrollToBottom}
                        className="fixed bottom-6 right-6 z-50 bg-teal-600 text-white p-2 rounded-full shadow-lg shadow-teal-200 hover:bg-slate-900 transition-all group flex items-center gap-1.5"
                      >
                        {newComplaintCount > 0 && (
                          <span className="bg-rose-500 text-[9px] font-black px-2 py-0.5 rounded-full ring-2 ring-white">
                            {newComplaintCount} NEW
                          </span>
                        )}
                        <ArrowDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  <div className={cn(
                    "w-full max-w-4xl px-4 lg:px-6 pb-8 mt-4 transition-all duration-500",
                    isSidebarOpen ? "mx-auto" : "ml-0 lg:ml-12"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-4 lg:mb-8 pt-10 gap-4">
                      <div>
                        <div className="flex items-center gap-3 lg:gap-4">
                          {selectedUni && universities.find(u => u.id === selectedUni)?.logo_url && (
                             <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full overflow-hidden shadow-sm border border-slate-200 bg-white shrink-0">
                                <img src={universities.find(u => u.id === selectedUni)?.logo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             </div>
                          )}
                          <h3 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tight leading-loose lg:leading-none">
                            {selectedUni ? universities.find(u => u.id === selectedUni)?.name : "National Reports"}
                          </h3>
                        </div>
                        <p className="text-[11px] lg:text-sm text-slate-500 mt-1 lg:mt-3 font-medium flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-indigo-400" />
                          {selectedUni ? "Institutional Signal activity" : "Real-time updates from all campuses"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="flex gap-2">
                           <select 
                             value={selectedUni} 
                             onChange={(e) => setSelectedUni(e.target.value)}
                             className="lg:hidden w-full rounded-xl border-slate-200 text-[10px] font-black uppercase tracking-wider px-4 py-2 bg-white shadow-sm focus:ring-indigo-500"
                           >
                             <option value="">All Institutions</option>
                             {Array.isArray(universities) && universities.map(u => (
                               <option key={u.id} value={u.id}>{u.name}</option>
                             ))}
                           </select>
                        </div>
                        
                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0 px-1">
                          <button
                            onClick={() => setSelectedCategory("ALL")}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                              selectedCategory === "ALL" 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 ring-2 ring-indigo-600/20" 
                                : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                          >
                            <Globe className="w-3.5 h-3.5" />
                            All Feed
                          </button>
                          {["CAFETERIA", "DORMITORY", "ACADEMIC", "SAFETY", "CLINIC"].map(cat => (
                            <button
                              key={cat}
                              onClick={() => setSelectedCategory(cat)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                                selectedCategory === cat 
                                  ? "bg-white text-indigo-600 shadow-md ring-2 ring-indigo-600 border-transparent" 
                                  : "bg-white/50 border border-slate-100 text-slate-400 hover:bg-white hover:text-slate-600"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center transition-colors",
                                selectedCategory === cat ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-400"
                              )}>
                                <CategoryIcon cat={cat} />
                              </div>
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
    
                    {/* Strategic Intelligence Dashboard */}
                    {(user.role === "MOE" || user.role === "UNI_ADMIN" || user.role === "SYSTEM_ADMIN") ? (
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8 lg:mb-10">
                        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1 ring-1 ring-slate-100/50">
                          <p className="text-[7px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Intelligence Feed</p>
                          <div className="flex items-center justify-between mt-1 lg:mt-2">
                            <p className="text-sm lg:text-2xl font-black text-slate-900 leading-none">{complaints.length}</p>
                            <BarChart3 className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-indigo-500 opacity-20" />
                          </div>
                        </div>
                        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1 ring-1 ring-slate-100/50">
                          <p className="text-[7px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Unaddressed Signals</p>
                          <div className="flex items-center justify-between mt-1 lg:mt-2">
                            <p className="text-sm lg:text-2xl font-black text-rose-500 leading-none">{complaints.filter(c => !c.university_response).length}</p>
                            <AlertCircle className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-rose-500 opacity-20" />
                          </div>
                        </div>
                        <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1 ring-1 ring-slate-100/50">
                          <p className="text-[7px] lg:text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Global Impact</p>
                          <div className="flex items-center justify-between mt-1 lg:mt-2">
                            <p className="text-sm lg:text-2xl font-black text-indigo-600 leading-none">{(complaints.length * 1.5).toFixed(0)}</p>
                            <TrendingUp className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-indigo-500 opacity-20" />
                          </div>
                        </div>
                        <div className="bg-indigo-600 p-4 lg:p-6 rounded-2xl lg:rounded-[2rem] border border-indigo-500 shadow-xl shadow-indigo-100/50 flex flex-col gap-1 ring-1 ring-indigo-500">
                          <p className="text-[7px] lg:text-[9px] font-black text-indigo-100/70 uppercase tracking-widest leading-none">Active Alerts</p>
                          <div className="flex items-center justify-between mt-1 lg:mt-2">
                            <p className="text-sm lg:text-2xl font-black text-white leading-none">{notifications.filter(n => n.is_read === false).length}</p>
                            <Bell className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-white opacity-40 animate-pulse" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <MetricSmallCard label="Active Tickets" value={complaints.length} />
                        <MetricSmallCard label="High Impact Cases" value={complaints.filter(c => c.upvotes_count > 50).length} color="rose" />
                      </div>
                    )}

                    <div className="space-y-4" id="complaints-list-container">
                      <AnimatePresence>
                        {lastSeenId && !hasScrolledToLastSeen && newCountSinceLastVisit > 0 && (
                           <motion.div
                             initial={{ opacity: 0, height: 0 }}
                             animate={{ opacity: 1, height: 'auto' }}
                             exit={{ opacity: 0, height: 0 }}
                             className="overflow-hidden"
                           >
                              <button 
                                onClick={() => {
                                   const el = document.getElementById(`complaint-${lastSeenId}`);
                                   if (el) {
                                     el.scrollIntoView({ behavior: 'auto', block: 'center' });
                                     setHasScrolledToLastSeen(true);
                                   }
                                }}
                                className="w-full py-6 border-2 border-dashed border-indigo-100 rounded-[2rem] text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-3 group bg-indigo-50/30 mb-4"
                              >
                                 <ArrowDown className="w-4 h-4 group-hover:translate-y-1 transition-transform" />
                                 Resume reading from your last visit
                                 <div className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[8px]">
                                    {newCountSinceLastVisit} NEW
                                 </div>
                              </button>
                           </motion.div>
                        )}
                      </AnimatePresence>

                        
 {complaints.filter(c => selectedCategory === "ALL" || c.category === selectedCategory).map((complaint, idx) => (
                          <div key={complaint.id} id={`complaint-${complaint.id}`}>
                            {idx === newCountSinceLastVisit && newCountSinceLastVisit > 0 && (
                               <div className="py-12 flex items-center gap-6">
                                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-6 py-2 bg-white rounded-full border border-slate-100 shadow-sm whitespace-nowrap">
                                     Newer reports above
                                  </span>
                                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                               </div>
                            )}
                            <ComplaintCard 
                              complaint={complaint} 
                              userRole={user.role}
                              user={user}
                              onUpvote={handleUpvote}
                              onRefresh={fetchComplaints}
                              onDelete={handleDeleteComplaint}
                              onEdit={handleEditComplaint}
                              onVisit={handleVisit}
                            />
                          </div>
                        ))
                      } ) : (
                  </div>
                </div>

                {/* --- Expandable Post Form Trigger --- */}
                {(user.role === "STUDENT" || user.role === "UNI_ADMIN" || user.role === "MOE") && (
                  <button 
                    onClick={() => setIsPostFormExpanded(!isPostFormExpanded)}
                    className={cn(
                      "fixed bottom-6 right-24 w-12 h-12 rounded-full flex items-center justify-center shadow-lg z-50 transition-all active:scale-90",
                      isPostFormExpanded 
                        ? "bg-slate-800 text-white rotate-90" 
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    )}
                  >
                    {isPostFormExpanded ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                  </button>
                )}

                {/* --- Compact Docked Post Form --- */}
                <AnimatePresence>
                  {isPostFormExpanded && (user.role === "STUDENT" || user.role === "UNI_ADMIN" || user.role === "MOE") && (
                    <motion.div 
                      initial={{ y: 200, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 200, opacity: 0 }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="shrink-0 bg-white border-t border-slate-200 p-4 z-40 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] relative"
                    >
                      <form onSubmit={async (e) => {
                        await submitComplaint(e);
                        setIsPostFormExpanded(false);
                      }} className={cn(
                        "px-6 transition-all duration-500",
                        isSidebarOpen ? "w-full max-w-4xl mx-auto" : "w-full max-w-4xl ml-0 lg:ml-12"
                      )}>
                        {/* Category Selection Row */}
                        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0 mr-2">
                            {user.role === "STUDENT" ? "Domain:" : "Tag:"}
                          </span>
                          {user.role === "STUDENT" ? (
                            systemCategories.map((cat, idx) => (
                              <label key={cat.id || cat.name || idx} className="cursor-pointer shrink-0">
                                <input type="radio" name="category" value={cat.name} required className="peer sr-only" />
                                <div className="px-3 py-1.5 border border-slate-200 rounded-full text-xs transition-all peer-checked:bg-indigo-50 peer-checked:border-indigo-500 peer-checked:text-indigo-700 hover:bg-slate-50 font-medium whitespace-nowrap">
                                  {cat.label}
                                </div>
                              </label>
                            ))
                          ) : (
                            ["ANNOUNCEMENT", "POLICY", "URGENT", "UPDATE"].map(cat => (
                              <label key={cat} className="cursor-pointer shrink-0">
                                <input type="radio" name="category" value={cat} required className="peer sr-only" />
                                <div className="px-3 py-1.5 border border-slate-200 rounded-full text-xs transition-all peer-checked:bg-rose-50 peer-checked:border-rose-500 peer-checked:text-rose-700 hover:bg-slate-50 font-medium bg-white whitespace-nowrap">
                                  {cat}
                                </div>
                              </label>
                            ))
                          )}
                        </div>

                        {/* Input Row */}
                        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                          {/* Evidence Upload */}
                          <div className="shrink-0 relative">
                            <input 
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setEvidenceFile(file);
                              }}
                              className="hidden" 
                              id="evidence-upload-compact"
                            />
                            <label 
                              htmlFor="evidence-upload-compact"
                              className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-xl transition-all cursor-pointer",
                                evidenceFile 
                                  ? "bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm" 
                                  : "bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 shadow-sm"
                              )}
                              title={evidenceFile ? evidenceFile.name : "Attach Evidence"}
                            >
                              <Paperclip className="w-3 h-3" />
                            </label>
                          </div>

                          {/* Textarea */}
                          <textarea 
                            id="post-description-input"
                            name="description" 
                            required
                            placeholder={user.role === "STUDENT" ? "Describe the incident..." : "Enter announcement..."}
                            className="flex-1 max-h-32 min-h-[40px] bg-transparent border-none focus:ring-0 resize-none py-3 px-4 text-sm text-slate-700"
                            rows={1}
                            onInput={(e) => {
                              e.currentTarget.style.height = 'auto';
                              e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 128) + 'px';
                            }}
                          />
                          
                          {/* Submit Button */}
                          <button 
                            type="submit" 
                            disabled={loading}
                            className="shrink-0 px-3 h-8 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50 text-[10px] uppercase tracking-wider"
                          >
                            <span>{loading ? "..." : "Send"}</span>
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                        
                        {evidenceFile && (
                          <div className="flex items-center gap-2 mt-2 px-2">
                            <span className="text-xs text-emerald-600 font-medium truncate max-w-[200px]">{evidenceFile.name}</span>
                            <button type="button" onClick={() => setEvidenceFile(null)} className="text-slate-400 hover:text-rose-500">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {activeTab === "ANALYTICS" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <motion.div 
                key="analytics"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8 w-full"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="National Tickets" value={complaints.length} color="slate" />
                  <StatCard label="Total Upvotes" value={complaints.reduce((a, b) => a + b.upvotes_count, 0)} color="slate" />
                  <StatCard label="Engagement High" value={`${Math.round((complaints.filter(c => c.upvotes_count > 50).length / (complaints.length || 1)) * 100)}%`} color="blue" />
                  <StatCard label="Critical Zones" value="4 High" color="red" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">Reporting Categories</h3>
                    <div className="h-[320px] w-full min-w-0" style={{ width: "99%" }}>
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie
                            data={systemCategories.map(cat => ({
                              name: cat.label,
                              value: complaints.filter(c => c.category === cat.name).length
                            }))}
                            innerRadius={70}
                            outerRadius={100}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {systemCategories.map((cat, index) => {
                              const colors = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#4f46e5", "#8b5cf6", "#ec4899"];
                              return <Cell key={cat.id || cat.name || index} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-8">National Signal Intensity</h3>
                    <div className="h-[320px] w-full min-w-0" style={{ width: "99%" }}>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={universities.map(u => ({
                          name: u.name.split(" ")[0],
                          intensity: complaints.filter(c => c.university_id === u.id).length
                        }))}>
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                          <Bar dataKey="intensity" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
          {activeTab === "HOTSPOTS" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              <motion.div 
                key="hotspots"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-6xl mx-auto space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center">
                        <Flame className="w-5 h-5" />
                      </div>
                      Institutional Hotspots
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Critical issue telemetry and systemic trend analysis</p>
                  </div>
                  <div className="flex gap-3">
                    <select 
                      value={selectedUni} 
                      onChange={(e) => setSelectedUni(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wider px-4 py-2.5 shadow-sm focus:ring-4 focus:ring-rose-500/20"
                    >
                      <option value="">All Units</option>
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {["CAFETERIA", "DORMITORY", "ACADEMIC", "SAFETY", "CLINIC"].map(cat => {
                    const catComplaints = complaints.filter(c => c.category === cat && (!selectedUni || c.university_id === selectedUni));
                    const totalImpact = catComplaints.reduce((acc, current) => acc + current.upvotes_count, 0);
                    const avgImpact = Math.round(totalImpact / (catComplaints.length || 1));
                    
                    return (
                      <div key={cat} className="bg-white rounded-3xl border border-slate-200 p-6 hover:shadow-xl hover:shadow-slate-100 transition-all group">
                        <div className="flex items-center justify-between mb-6">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                            totalImpact > 100 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                          )}>
                            <CategoryIcon cat={cat} />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Impact Factor</p>
                            <p className={cn("text-xl font-black", totalImpact > 100 ? "text-rose-600" : "text-slate-900")}>
                               {totalImpact}
                            </p>
                          </div>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">{cat}</h3>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, (totalImpact / 500) * 100)}%` }}
                              className={cn("h-full", totalImpact > 100 ? "bg-rose-500" : "bg-indigo-500")}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">{catComplaints.length} Reports</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                          Avg engagement of {avgImpact} student supports per report.
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Telemetry Feed</h3>
                    <TrendingUp className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Strategic Issue</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Domain</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Engagement</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Operational Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {complaints.filter(c => !selectedUni || c.university_id === selectedUni).slice(0, 15).map((complaint, idx) => (
                          <tr key={complaint.id || idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs font-bold text-slate-800 line-clamp-1">{complaint.description}</span>
                                <span className="text-[10px] text-slate-400 font-medium">{complaint.university_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black uppercase text-slate-600">
                                {complaint.category}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                     <ThumbsUp className="w-3 h-3 text-emerald-500" />
                                     <span className="text-xs">{complaint.likes_count}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                     <MessageCircle className="w-3 h-3 text-indigo-500" />
                                     <span className="text-xs">{complaint.comments_count}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => {
                                  setSelectedUni(complaint.university_id);
                                  setSelectedCategory(complaint.category);
                                  setActiveTab("FEED");
                                  showNotify("Navigating to incident context...");
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1.5"
                              >
                                View Context
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
          {activeTab === "DEPT_INTAKE" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto space-y-4 lg:space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
                      {user.role === "UNI_ADMIN" ? "Institutional Insights" : "Strategic Signal Intake"}
                    </h2>
                    <p className="text-xs lg:text-sm text-slate-500 font-medium">
                      {user.role === "UNI_ADMIN" ? "Scope: Full University Strategic Monitoring" : (
                        <>Strategic Domain: <span className="text-indigo-600 font-bold uppercase tracking-widest">{user?.assigned_category}</span></>
                      )}
                    </p>
                  </div>
                  <div className="bg-white p-2 lg:p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 w-fit">
                    <div className="text-right">
                      <p className="text-[8px] lg:text-[10px] uppercase text-slate-400 font-bold">Unread Alerts</p>
                      <p className="text-xs lg:text-sm font-black text-rose-500">{notifications.filter(n => n.is_read === false).length}</p>
                    </div>
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500">
                      <Bell className="w-4 h-4 lg:w-5 lg:h-5" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {notifications.length > 0 ? (
                    notifications.map(notif => (
                      <div 
                        key={notif.id}
                        className={cn(
                          "bg-white p-5 rounded-3xl border transition-all hover:shadow-md cursor-pointer",
                          notif.is_read ? "border-slate-300 opacity-90" : "border-indigo-200 shadow-sm shadow-indigo-100/50"
                        )}
                        onClick={async () => {
                          if (!notif.is_read) {
                            await fetch(`/api/notifications/${notif.id}/read`, { method: "PATCH" });
                            fetchNotifications();
                          }
                          // Scroll to complaint or open it
                          const comp = complaints.find(c => c.id === notif.complaint_id);
                          if (comp) {
                             setActiveTab("FEED");
                             setSelectedUni(comp.university_id);
                             showNotify(`Focusing on report from ${notif.student_name}`);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                               notif.is_read ? "bg-slate-100 text-slate-400" : "bg-rose-100 text-rose-600"
                             )}>
                               {notif.is_read ? "Evaluated" : "New Intake"}
                             </span>
                             <span className="text-[10px] text-slate-400 font-bold">{formatTimeAgo(notif.created_at)}</span>
                          </div>
                          <ChevronUp className="w-4 h-4 text-slate-300 rotate-90" />
                        </div>
                        <p className="text-sm font-bold text-slate-900 mb-1">Issue reported by {notif.student_name}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 italic">"{notif.description}"</p>
                      </div>
                    ))
                  ) : (
                    <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                      <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No unread operational alerts</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === "SYSTEM" && user.role === "UNI_ADMIN" && (
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-6xl mx-auto space-y-6 lg:space-y-8"
              >
                <div>
                  <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">Institutional Governance</h2>
                  <p className="text-xs lg:text-sm text-slate-500 font-medium italic">Manage departmental credentials and cross-unit notification routing.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <section className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm">
                       <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 lg:mb-6 flex items-center gap-2">
                         <Plus className="w-4 h-4 text-indigo-500" /> Spawn Department Head
                       </h3>
                       <form onSubmit={createDeptHead} className="space-y-4">
                         <div className="space-y-1.5">
                           <label className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase ml-1">Official Name</label>
                           <input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="e.g. Cafeteria Director" required className="w-full rounded-xl border-slate-200 text-sm py-2.5 lg:py-2 px-3 focus:ring-indigo-500 bg-slate-50" />
                         </div>
                         <div className="space-y-1.5">
                           <label className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase ml-1">Jurisdiction</label>
                           <select value={newDeptCat} onChange={e => setNewDeptCat(e.target.value)} required className="w-full rounded-xl border-slate-200 text-sm py-2.5 lg:py-2 px-3 focus:ring-indigo-500 bg-slate-50 outline-none">
                              <option value="">Select Domain</option>
                              {systemCategories.map((c, idx) => (
                                <option key={c.id || c.name || idx} value={c.name}>{c.label}</option>
                              ))}
                           </select>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1.5">
                             <label className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase ml-1">Username</label>
                             <input value={newDeptUser} onChange={e => setNewDeptUser(e.target.value)} required className="w-full rounded-xl border-slate-200 text-xs py-2.5 lg:py-2 px-3 bg-slate-50" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                             <div className="relative">
                               <input 
                                 type={showPassword ? "text" : "password"} 
                                 value={newDeptPass} 
                                 onChange={e => setNewDeptPass(e.target.value)} 
                                 required 
                                 className="w-full rounded-xl border-slate-200 text-xs py-2.5 lg:py-2 px-3 pr-9 bg-slate-50" 
                               />
                               <button 
                                 type="button"
                                 onClick={() => setShowPassword(!showPassword)}
                                 className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                               >
                                 {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                               </button>
                             </div>
                           </div>
                         </div>
                         <button disabled={loading} type="submit" className="w-full bg-slate-900 text-white text-[9px] lg:text-[10px] font-black uppercase py-4 lg:py-3 rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-200 tracking-widest">
                           Provision Sub-Account
                         </button>
                       </form>
                    </section>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <section className="bg-white rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 lg:px-6 py-3 lg:py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                         <h3 className="text-[10px] lg:text-xs font-bold text-slate-900 uppercase tracking-wider">Active Departmental Directory</h3>
                         <Users className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="divide-y divide-slate-100">
                        {activeDeptHeads.length > 0 ? activeDeptHeads.map((head, idx) => (
                          <div key={head.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                                <UserCircle className="w-5 h-5 lg:w-6 lg:h-6" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs lg:text-sm font-bold text-slate-900 truncate">{head.full_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[8px] lg:text-[9px] font-black text-indigo-600 uppercase tracking-widest">{head.assigned_category}</span>
                                  <span className="hidden sm:inline text-[8px] lg:text-[9px] text-slate-400 font-bold uppercase px-2 border-l border-slate-200">@{head.username}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                               <div className="text-right mr-2 lg:mr-4">
                                  <p className="text-[7px] lg:text-[8px] uppercase text-slate-400 font-bold">Status</p>
                                  <p className="text-[9px] lg:text-[10px] font-bold text-emerald-600">ACTIVE</p>
                               </div>
                               <button className="p-2 text-slate-400 hover:text-rose-600 transition-colors">
                                 <X className="w-4 h-4" />
                               </button>
                            </div>
                          </div>
                        )) : (
                          <div className="py-16 lg:py-20 text-center">
                            <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest italic">No departmental heads provisioned yet.</p>
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                       <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                         <RefreshCw className="w-4 h-4 text-indigo-500" /> Routing Rules Management
                       </h3>
                       <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                         <p className="text-xs text-indigo-900 font-medium leading-relaxed">
                            System is currently using <span className="font-bold underline">Direct Context Routing</span>. All reports tagged by students are instantly mirrored to the relevant departmental workspace.
                         </p>
                       </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === "SYSTEM" && user.role === "SYSTEM_ADMIN" && (
            <div className="flex-1 overflow-hidden flex flex-col bg-slate-50">
              <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-4 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="min-w-0">
                    <h2 className="text-lg lg:text-xl font-black text-slate-900 tracking-tight truncate">Control Panel</h2>
                    <p className="text-[8px] lg:text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">Manage your system settings and university users</p>
                  </div>
                  <button onClick={fetchSystemData} className="p-2 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shrink-0 ml-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                    <div className="flex gap-3 lg:gap-4 overflow-x-auto pb-2 no-scrollbar">
                      {[
                        { id: "DASHBOARD", label: "Overview", icon: <Activity className="w-3 h-3" /> },
                        { id: "TENANTS", label: "Universities", icon: <Building2 className="w-3 h-3" /> },
                        { id: "USERS", label: "User List", icon: <Users className="w-3 h-3" /> },
                        { id: "STUDENT_REGISTRY", label: "Student Registry", icon: <ShieldCheck className="w-3 h-3" /> },
                        { id: "POLICIES", label: "Banned Words", icon: <ShieldCheck className="w-3 h-3" /> },
                        { id: "AUDIT", label: "Activity Log", icon: <History className="w-3 h-3" /> }
                      ].map(tab => (
                        <button 
                          key={tab.id}
                          onClick={() => {
                            setGovSubTab(tab.id as any);
                            setViewingUniId(null);
                          }}
                          className={cn(
                            "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all whitespace-nowrap border",
                            govSubTab === tab.id 
                              ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200" 
                              : "text-slate-400 border-transparent hover:text-slate-900 hover:bg-white hover:border-slate-200"
                          )}
                        >
                          {tab.icon}
                          {tab.label}
                        </button>
                      ))}
                    </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              <motion.div 
                key={govSubTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-7xl mx-auto space-y-6 lg:space-y-8 pb-10"
              >
                {govSubTab === "DASHBOARD" && (
                  <div className="space-y-6 lg:space-y-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                      <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity hidden lg:block">
                          <Building2 className="w-12 h-12" />
                        </div>
                        <p className="text-[7px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 lg:mb-4">Universities</p>
                        <p className="text-xl lg:text-4xl font-black text-slate-900 tracking-tight">{systemUnis.length}</p>
                        <div className="mt-2 lg:mt-4 flex items-center gap-1 lg:gap-1.5 text-[8px] lg:text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                          <div className="w-1 lg:w-1.5 h-1 lg:h-1.5 bg-emerald-500 rounded-full"></div>
                          <span className="truncate">All normal</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity hidden lg:block">
                          <Users className="w-12 h-12" />
                        </div>
                        <p className="text-[7px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 lg:mb-4">Users</p>
                        <p className="text-xl lg:text-4xl font-black text-slate-900 tracking-tight">{systemUsers.length}</p>
                        <div className="mt-2 lg:mt-4 flex items-center gap-1 lg:gap-1.5 text-[8px] lg:text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
                          <TrendingUp className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                          <span className="truncate">Growing</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity hidden lg:block">
                          <MessageSquare className="w-12 h-12" />
                        </div>
                        <p className="text-[7px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 lg:mb-4">Reports</p>
                        <p className="text-xl lg:text-4xl font-black text-slate-900 tracking-tight">{complaints.length}</p>
                        <div className="mt-2 lg:mt-4 flex items-center gap-1 lg:gap-1.5 text-[8px] lg:text-[10px] font-bold text-amber-600 uppercase tracking-wide">
                          <Activity className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                          <span className="truncate">Active</span>
                        </div>
                      </div>
                      <div className="bg-white p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity hidden lg:block">
                          <ShieldCheck className="w-12 h-12" />
                        </div>
                        <p className="text-[7px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 lg:mb-4">Logs</p>
                        <p className="text-xl lg:text-4xl font-black text-slate-900 tracking-tight">{systemLogs.length}</p>
                        <div className="mt-2 lg:mt-4 flex items-center gap-1 lg:gap-1.5 text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                          <Lock className="w-2.5 h-2.5 lg:w-3 lg:h-3" />
                          <span className="truncate">Protected</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2 space-y-6">
                        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                          <div className="flex items-center justify-between mb-8">
                             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">System Health Check</h3>
                             <div className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-lg border border-emerald-100 flex items-center gap-2">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                               SYSTEMS ONLINE
                             </div>
                          </div>
                          <div className="space-y-4">
                             {[
                               { label: "Main Database", status: "Healthy", ping: "4ms" },
                               { label: "Login & Security Service", status: "Active", ping: "12ms" },
                               { label: "University Connections", status: "Connected", ping: "2ms" },
                               { label: "Action Logs Storage", status: "Running", ping: "0ms" }
                             ].map((sys, idx) => (
                               <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                 <div className="flex items-center gap-3">
                                   <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200"></div>
                                   <span className="text-xs font-bold text-slate-700">{sys.label}</span>
                                 </div>
                                 <div className="flex items-center gap-4">
                                   <span className="text-[10px] font-black text-slate-400 uppercase">{sys.ping}</span>
                                   <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{sys.status}</span>
                                 </div>
                               </div>
                             ))}
                          </div>
                        </section>
                      </div>
                      <div className="space-y-6">
                        <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                          <div className="relative z-10">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-indigo-400">Admin Guidelines</h3>
                            <p className="text-sm font-medium leading-relaxed opacity-90 mb-6">
                              As a System Admin, you have full control over all universities and users. Use this power to support students and ensure fair reporting across the country.
                            </p>
                            <div className="space-y-3">
                              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                                <Scale className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Fairness Protocol</span>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Secure Access Control</span>
                              </div>
                            </div>
                          </div>
                          <div className="absolute bottom-0 right-0 -mb-10 -mr-10 opacity-10">
                            <Scale className="w-48 h-48" />
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>
                )}
                {govSubTab === "TENANTS" && (
                  <div className="space-y-8">
                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl max-w-4xl mx-auto">
                        <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-2">How to manage Universities</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-indigo-900">Stop / Allow</p>
                            <p className="text-[10px] text-indigo-700 font-medium">Block or allow a university to use the system instantly.</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-indigo-900">User Control</p>
                            <p className="text-[10px] text-indigo-700 font-medium">Click "Users" to reset passwords for staff or students.</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-indigo-900">Onboarding</p>
                            <p className="text-[10px] text-indigo-700 font-medium">Add new universities. It will create an admin account for them.</p>
                          </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-2.5">
                                <Building2 className="w-4 h-4 text-indigo-500" />
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Add New University</h3>
                              </div>
                            </div>
                            <div className="p-6">
                              <form onSubmit={provisionInstitution} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">University Name</label>
                                    <input 
                                      value={newUniName}
                                      onChange={(e) => setNewUniName(e.target.value)}
                                      placeholder="e.g. Addis Ababa University" 
                                      className="w-full rounded-xl border-slate-200 text-sm py-2.5 px-4 focus:ring-indigo-500 bg-slate-50 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">City / Region</label>
                                    <input 
                                      value={newUniLocation}
                                      onChange={(e) => setNewUniLocation(e.target.value)}
                                      placeholder="e.g. Addis Ababa" 
                                      className="w-full rounded-xl border-slate-200 text-sm py-2.5 px-4 focus:ring-indigo-500 bg-slate-50 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Admin Full Name</label>
                                    <input 
                                      value={newUniAdminName}
                                      onChange={(e) => setNewUniAdminName(e.target.value)}
                                      placeholder="e.g. John Doe" 
                                      className="w-full rounded-xl border-slate-200 text-sm py-2.5 px-4 focus:ring-indigo-500 bg-slate-50 transition-all"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Admin Username</label>
                                    <input 
                                      value={newUniAdminUser}
                                      onChange={(e) => setNewUniAdminUser(e.target.value)}
                                      placeholder="e.g. admin_johndoe" 
                                      className="w-full rounded-xl border-slate-200 text-sm py-2.5 px-4 focus:ring-indigo-500 bg-slate-50 transition-all"
                                    />
                                  </div>
                                  <div className="col-span-2 space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Admin Password (leave blank to gen)</label>
                                    <input 
                                      type="password"
                                      value={newUniAdminPass}
                                      onChange={(e) => setNewUniAdminPass(e.target.value)}
                                      placeholder="Enter custom password" 
                                      className="w-full rounded-xl border-slate-200 text-sm py-2.5 px-4 focus:ring-indigo-500 bg-slate-50 transition-all"
                                    />
                                  </div>
                                </div>
                                <button 
                                  disabled={loading}
                                  type="submit" 
                                  className="w-full bg-indigo-600 text-white text-xs font-bold py-3.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                                >
                                  Create University Profile
                                </button>
                              </form>

                          <AnimatePresence>
                            {provisionedCreds && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="mt-6 p-4 bg-indigo-900 rounded-xl relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 p-2">
                                  <button onClick={() => setProvisionedCreds(null)} className="text-indigo-400 hover:text-white">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Admin Login Created</h4>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between border-b border-indigo-800 pb-1">
                                    <span className="text-[9px] text-indigo-300 font-bold uppercase">Admin Username</span>
                                    <span className="text-[9px] text-white font-mono font-bold">{provisionedCreds.username}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-indigo-800 pb-1">
                                    <span className="text-[9px] text-indigo-300 font-bold uppercase">Initial Password</span>
                                    <span className="text-[9px] text-emerald-400 font-mono font-bold selection:bg-emerald-500/30">{provisionedCreds.password}</span>
                                  </div>
                                  <p className="text-[8px] text-indigo-400 font-medium italic mt-2">
                                    Save these details. They will not be shown again.
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </section>
                    </div>

                    <div className="space-y-6">
                      <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                           <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900">University List</h3>
                           <Globe className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="divide-y divide-slate-100">
                          {systemUnis.map((uni, idx) => (
                            <div key={uni.id || idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{uni.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn(
                                      "text-[8px] font-black px-1.5 py-0.5 rounded uppercase",
                                      uni.is_frozen ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                                    )}>
                                      {uni.is_frozen ? "Blocked" : "Active"}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">{uni.location}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => toggleUniFreeze(uni.id, uni.is_frozen)}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-2",
                                    uni.is_frozen 
                                      ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100" 
                                      : "bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-100"
                                  )}
                                  title={uni.is_frozen ? "Allow Access" : "Stop Access"}
                                >
                                  {uni.is_frozen ? <CheckCircle className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                  {uni.is_frozen ? "Allow" : "Stop"}
                                </button>
                                <button 
                                  onClick={() => fetchUniUsers(uni.id)}
                                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 uppercase tracking-wider flex items-center gap-2"
                                  title="Manage Staff & Students"
                                >
                                  <Users className="w-3 h-3" />
                                  Users
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              )}

                {govSubTab === "USERS" && (
                  <div className="space-y-6">
                    <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                              <Users className="w-4 h-4 text-indigo-500" /> 
                              {viewingUniId ? (
                                <span>Users of {systemUnis.find(u => u.id === viewingUniId)?.name || 'University'}</span>
                              ) : (
                                <span>University User Directory</span>
                              )}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                              {viewingUniId ? `Showing ${selectedUniUsers.length} staff & students` : `Manage ${systemUsers.length} total users across all campuses`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {viewingUniId && (
                              <button 
                                onClick={() => {
                                  setViewingUniId(null);
                                  fetchSystemData();
                                }}
                                className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                              >
                                View All Users
                              </button>
                            )}
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                              <input 
                                placeholder="Search by name, ID, or username..." 
                                className="pl-9 pr-4 py-2 bg-white border-slate-200 rounded-xl text-xs w-64 focus:ring-indigo-500 transition-all font-medium"
                                onChange={(e) => {/* Local filter logic could go here */}}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">User Details</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">University</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Quick Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {(viewingUniId ? selectedUniUsers : systemUsers).map(u => (
                              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs uppercase shadow-inner">
                                      {u.full_name?.charAt(0)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">{u.full_name}</p>
                                      <p className="text-[10px] font-mono text-slate-400 font-bold">@{u.username} • {u.student_id_number || 'SYSTEM'}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                    <span className="text-xs font-bold text-slate-600">{u.university_name || (u.role === 'MOE' ? 'Ministry of Education' : 'Root System')}</span>
                                  </div>
                                  <p className="text-[9px] text-indigo-400 font-black uppercase mt-0.5 tracking-tighter">{u.role}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border",
                                    u.account_status === 'ACTIVE' 
                                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                                      : "bg-rose-50 text-rose-600 border-rose-100"
                                  )}>
                                    {u.account_status || 'ACTIVE'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2 transition-opacity">
                                    <button 
                                      onClick={() => resetUserPassword(u.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-slate-800 transition-all shadow-sm"
                                      title="Reset Password"
                                    >
                                      <Key className="w-3 h-3" />
                                      Reset Pass
                                    </button>
                                    <button 
                                      onClick={() => updateUserStatus(u.id, u.account_status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-all"
                                      title="Ban / Unban User"
                                    >
                                      <Slash className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={() => deleteUserAccount(u.id)}
                                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                                      title="Delete Account"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    <section className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
                       <ShieldPlus className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                       <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Admin Rules</h3>
                       <p className="text-[10px] text-slate-400 font-medium max-w-sm mx-auto">
                         System changes are recorded for safety. Only reset passwords or delete users if you have permission to do so.
                       </p>
                    </section>
                  </div>
                )}

                {govSubTab === "STUDENT_REGISTRY" && (
                  <div className="space-y-6 max-w-5xl mx-auto">
                    {/* Upper Action Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Left: File uploader box */}
                      <div className="md:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-2">
                            <Upload className="w-4 h-4 text-indigo-500" />
                            Excel Bulk Upload
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed mb-4">
                            Import national registry student IDs. Excel columns must contain <span className="text-indigo-600 font-black">"Student ID"</span> and <span className="text-indigo-600 font-black">"Full Name"</span>.
                          </p>

                          <div className="space-y-3 mb-6">
                            <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Target University</label>
                            <select 
                              value={targetUniImport}
                              onChange={(e) => setTargetUniImport(e.target.value)}
                              className="w-full text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 text-slate-800 py-2.5 px-3 focus:ring-2 focus:ring-indigo-600 outline-none"
                            >
                              <option value="AUTO">✨ Auto-Detect From ID Prefix</option>
                              {systemUnis.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="relative flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-slate-50 rounded-2xl p-4 lg:p-6 transition-all cursor-pointer group">
                            {isUploadingRegistry ? (
                              <div className="text-center">
                                <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Uploading Ledger...</span>
                              </div>
                            ) : (
                              <div className="text-center">
                                <FileText className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 mx-auto mb-2 transition-colors" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 block group-hover:text-indigo-600">Select Excel file</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase">.xlsx or .xls file formats</span>
                              </div>
                            )}
                            <input 
                              type="file" 
                              accept=".xlsx,.xls" 
                              disabled={isUploadingRegistry}
                              onChange={handleExcelImport}
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </div>

                      {/* Right: Explainer & Statistics banner */}
                      <div className="md:col-span-2 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 lg:p-8 flex flex-col justify-between shadow-lg shadow-indigo-100">
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <span className="px-2.5 py-1 bg-white/10 rounded-full text-[9px] font-black tracking-widest uppercase text-indigo-300">Operational Ledger</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-[8px] uppercase tracking-widest font-black text-slate-300">Ledger Online</span>
                          </div>
                          <h3 className="text-xl lg:text-2xl font-black tracking-tight mb-2">Student Pre-Registration Registry</h3>
                          <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                            This panel allows ministries and educational system administrators to import verified university enrollment records. Students can register instantly using their verified identifiers without manually choosing academic institutions, blocking spoofing attempts and maintaining strict data integrity.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10">
                          <div>
                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Total Pre-Registered</span>
                            <p className="text-2xl font-black text-white mt-1 font-mono">{preRegisteredList.length}</p>
                          </div>
                          <div>
                            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Prefix Mappings</span>
                            <p className="text-xs font-semibold text-indigo-200 mt-2">DDU, AAU, ASTU, UOG, BDU</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Registry Table List */}
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-slate-950">Enrollment Directory</h3>
                          <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Showing verified student list in historical registration order</p>
                        </div>

                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input 
                            placeholder="Filter by Student ID or Name..." 
                            value={registrySearchQuery}
                            onChange={(e) => setRegistrySearchQuery(e.target.value)}
                            className="bg-slate-50 border border-slate-200 pl-9 pr-4 py-1.5 rounded-xl text-xs w-64 focus:ring-2 focus:ring-indigo-600 outline-none font-medium"
                          />
                        </div>
                      </div>

                      <div className="overflow-x-auto flex-1 min-h-[300px]">
                        {preRegisteredList.length === 0 ? (
                          <div className="py-24 text-center">
                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No pre-registration records found. Load list via Excel above.</p>
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                <th className="py-3 px-6">Student ID</th>
                                <th className="py-3 px-6">Full Name</th>
                                <th className="py-3 px-6">Assigned Campus</th>
                                <th className="py-3 px-6">Pre-Registered Date</th>
                                <th className="py-3 px-6 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {preRegisteredList
                                .filter(s => {
                                  const search = registrySearchQuery.toLowerCase();
                                  return (s.student_id?.toLowerCase() || "").includes(search) || 
                                         (s.full_name?.toLowerCase() || "").includes(search) ||
                                         (s.university_name?.toLowerCase() || "").includes(search);
                                })
                                .map(student => (
                                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3.5 px-6 font-mono font-bold text-xs text-indigo-700">{student.student_id}</td>
                                    <td className="py-3.5 px-6 font-semibold text-xs text-slate-900">{student.full_name}</td>
                                    <td className="py-3.5 px-6">
                                      {student.university_name ? (
                                        <span className="px-2.5 py-1 bg-slate-100 text-[10px] font-bold text-slate-700 rounded-lg">
                                          {student.university_name}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-100 text-[9px] text-yellow-700 rounded uppercase font-black tracking-wider">
                                          Not Assigned
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-6 text-[11px] font-medium text-slate-400">
                                      {new Date(student.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                                    </td>
                                    <td className="py-3.5 px-6 text-right">
                                      <button 
                                        type="button"
                                        onClick={() => deletePreRegisteredStudent(student.id)} 
                                        className="p-1 px-2.5 bg-slate-50 text-slate-400 font-bold border border-slate-200/50 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 rounded-lg text-[10px] transition-colors"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {govSubTab === "POLICIES" && (
                   <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                     <div className="lg:col-span-1 space-y-6">
                        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden p-6 shadow-sm">
                          <div className="flex items-center gap-2 mb-6 text-rose-500">
                             <ShieldX className="w-4 h-4" />
                             <h3 className="text-xs font-black uppercase tracking-widest">Word Filter</h3>
                          </div>
                          <form onSubmit={addBannedWord} className="flex gap-2 mb-6">
                            <input 
                              value={newWord}
                              onChange={(e) => setNewWord(e.target.value)}
                              placeholder="Add restriction..." 
                              className="flex-1 rounded-xl border-slate-200 text-xs py-2 px-4 shadow-inner"
                            />
                            <button type="submit" className="bg-slate-900 text-white p-2 rounded-xl hover:bg-black transition-colors"><Plus className="w-4 h-4" /></button>
                          </form>
                          <div className="flex flex-wrap gap-2">
                             {bannedWords.map(bw => (
                               <span key={bw.id} className="flex items-center gap-2 bg-rose-50 text-rose-700 px-2 py-1 rounded-md text-[9px] font-bold border border-rose-100">
                                 {bw.word}
                                 <button onClick={() => deleteBannedWord(bw.id)}><X className="w-3 h-3" /></button>
                               </span>
                             ))}
                          </div>
                        </section>
                     </div>
                     <div className="lg:col-span-2 space-y-6">
                        <section className="bg-white rounded-2xl border border-slate-200 p-8">
                           <h3 className="text-sm font-black uppercase tracking-widest mb-6 border-b border-slate-100 pb-4 text-indigo-600">Dynamic Categories</h3>
                           
                           <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-400 uppercase mb-3 px-1">Register New Channel</p>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="System Key (e.g. SAFETY)" className="text-[11px] px-3 py-2 border rounded-lg bg-white" />
                                <input value={newCatLabel} onChange={(e) => setNewCatLabel(e.target.value)} placeholder="Public Label" className="text-[11px] px-3 py-2 border rounded-lg bg-white" />
                              </div>
                              <div className="flex gap-2">
                                <input value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Description for students..." className="flex-1 text-[11px] px-3 py-2 border rounded-lg bg-white" />
                                <button onClick={addCategory} className="bg-indigo-600 text-white px-4 rounded-lg hover:bg-indigo-700 transition-colors"><Plus className="w-4 h-4" /></button>
                              </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              {systemCategories.map(c => (
                                <div key={c.id || c.name} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start">
                                   <div>
                                     <p className="text-[10px] font-black text-indigo-600 mb-1">{c.name}</p>
                                     <p className="text-xs font-bold text-slate-900">{c.label}</p>
                                   </div>
                                   <button onClick={() => deleteCategory(c.id)} className="text-slate-300 hover:text-rose-500">
                                     <Trash2 className="w-3 h-3" />
                                   </button>
                                </div>
                              ))}
                           </div>
                        </section>
                     </div>
                   </div>
                )}

                {govSubTab === "AUDIT" && (
                   <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm max-w-4xl mx-auto">
                      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                         <div className="flex items-center gap-2 text-indigo-600">
                           <History className="w-4 h-4" />
                           <h3 className="text-xs font-black uppercase tracking-widest">System Activity Log</h3>
                         </div>
                         <Lock className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                      <div className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
                        {systemLogs.map(log => (
                          <div key={log.id} className="p-5 hover:bg-slate-50/50 transition-all">
                             <div className="flex items-center justify-between mb-3">
                               <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase border",
                                    log.action === "CONTENT_FLAGGED" ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                  )}>
                                    {log.action}
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-bold">{new Date(log.created_at).toLocaleString()}</span>
                               </div>
                               <div className="flex items-center gap-1.5">
                                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                 <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Verified</span>
                               </div>
                             </div>
                             <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                                <span className="text-[10px] font-black text-slate-700">{log.user_name || "Protocol Handler"}</span>
                             </div>
                             <div className="bg-slate-900 rounded-2xl p-4 overflow-x-auto border border-slate-800">
                                <pre className="text-[9px] font-mono text-emerald-400 selection:bg-emerald-500/30">
                                   {JSON.stringify(log.details, null, 2)}
                                </pre>
                             </div>
                          </div>
                        ))}
                      </div>
                   </section>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}
const NavButton = ({ active, onClick, icon, label, badge }: NavButtonProps) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative shrink-0",
      active 
        ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
    )}
  >
    <div className={cn(
      "w-5 h-5 flex items-center justify-center rounded-md transition-all shrink-0",
      active ? "bg-indigo-50" : "bg-transparent"
    )}>
      {icon}
    </div>
    <span className="text-[9px] sm:text-xs tracking-tight whitespace-nowrap">{label}</span>
  </button>
);

const BottomNavTab = ({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number }) => (
  <button 
    onClick={onClick}
    className={cn(
      "relative flex flex-col items-center gap-1 transition-all",
      active ? "text-indigo-600 scale-110" : "text-slate-400 hover:text-slate-600"
    )}
  >
    <div className={cn(
      "p-1.5 rounded-xl transition-all",
      active && "bg-indigo-50"
    )}>
      {icon}
    </div>
    <span className={cn("text-[8px] font-black uppercase tracking-tighter transition-all", active ? "opacity-100" : "opacity-0 h-0 overflow-hidden")}>
      {label}
    </span>
    {badge !== undefined && badge > 0 && (
      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-white text-[8px] font-black ring-2 ring-white">
        {badge}
      </span>
    )}
  </button>
);

const MetricSmallCard = ({ label, value, color = "slate" }: { label: string, value: string | number, color?: "rose" | "amber" | "emerald" | "slate" }) => {
  const colors = {
    rose: "bg-rose-500",
    amber: "bg-amber-400",
    emerald: "bg-emerald-500",
    slate: "bg-slate-400"
  };
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  );
};

const StatCard = ({ label, value, color }: { label: string, value: string | number, color: "blue" | "red" | "green" | "slate" }) => {
  const colors = {
    blue: "text-indigo-600 bg-indigo-50 border-indigo-100",
    red: "text-rose-600 bg-rose-50 border-rose-100",
    green: "text-emerald-600 bg-emerald-50 border-emerald-100",
    slate: "text-slate-600 bg-slate-50 border-slate-100"
  };
  return (
    <div className={cn("p-6 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md", colors[color])}>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2 opacity-70">{label}</p>
      <p className="text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}
