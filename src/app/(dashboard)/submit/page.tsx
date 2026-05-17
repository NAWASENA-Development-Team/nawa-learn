// app/(dashboard)/submit/page.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const moduleSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  subject: z.string().min(2, "Subject is required"),
  category: z.string().min(2, "Category is required"),
  contentUrl: z.string().url("Must be a valid URL (Google Drive, PDF link, etc)"),
});

type FormData = z.infer<typeof moduleSchema>;

export default function SubmitModulePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    resolver: zodResolver(moduleSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // API call to Next.js Route Handler -> creates pending 'submissions' record
      const res = await fetch("/api/modules/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        alert("Module submitted for review! You will earn points once approved.");
        reset();
      }
    } catch (error) {
      console.error(error);
      alert("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 mt-8">
      <h2 className="text-2xl font-bold mb-6">Contribute a Module</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-zinc-950 p-6 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
          <input 
            {...register("title")}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            placeholder="e.g. Ringkasan Materi Fisika Kuantum"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input 
              {...register("subject")}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select 
              {...register("category")}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="">Select...</option>
              <option value="UTBK">UTBK</option>
              <option value="Olimpiade">Olimpiade</option>
              <option value="Reguler">Materi Reguler</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Document Link (G-Drive, Notion, etc)</label>
          <input 
            {...register("contentUrl")}
            type="url"
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-500 disabled:opacity-70 font-medium transition-colors"
        >
          {isSubmitting ? "Submitting..." : "Submit for Moderation"}
        </button>
      </form>
    </div>
  );
}