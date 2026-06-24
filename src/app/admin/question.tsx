'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';    
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function QuestionsPage() {
  const supabase = createClient();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionsPerPage] = useState(10);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );

  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    options: [{}],
    correct_answers: [],
    time_limit: 30,
    difficulty: 'medium',
    is_active: true,
  });

  // Fetch questions
  useEffect(() => {
    fetchQuestions();
  }, [currentPage]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error, count } = await supabase
        .from('questions')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * questionsPerPage, currentPage * questionsPerPage - 1);

      if (error) throw error;

      setQuestions(data || []);
      setTotalQuestions(count || 0);
      setTotalPages(Math.ceil((count || 0) / questionsPerPage));
    } catch (error: any) {
      console.error('Error fetching questions:', error);
      setError(error.message);
      toast.error('Failed to fetch questions');
    } finally {
      setLoading(false);
    }
  };

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Handle option changes
  const handleOptionChange = (index: number, key: string, value: string) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [key]: value };
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  // Add option
  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, { option_text: '', is_correct: false }],
    }));
  };

  // Remove option
  const removeOption = (index: number) => {
    const newOptions = formData.options.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, options: newOptions }));
  };

  // Create question
  const createQuestion = async () => {
    try {
      const { error } = await supabase.from('questions').insert({
        question_text: formData.question_text,
        question_type: formData.question_type,
        options: formData.options,
        correct_answers: formData.correct_answers,
        time_limit: formData.time_limit,
        difficulty: formData.difficulty,
        is_active: formData.is_active,
      });

      if (error) throw error;

      toast.success('Question created successfully');
      setIsCreateDialogOpen(false);
      fetchQuestions();
      resetForm();
    } catch (error: any) {
      console.error('Error creating question:', error);
      setError(error.message);
      toast.error('Failed to create question');
    }
  };

  // Update question
  const updateQuestion = async () => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          question_text: formData.question_text,
          question_type: formData.question_type,
          options: formData.options,
          correct_answers: formData.correct_answers,
          time_limit: formData.time_limit,
          difficulty: formData.difficulty,
          is_active: formData.is_active,
        })
        .eq('id', selectedQuestion?.id);

      if (error) throw error;

      toast.success('Question updated successfully');
      setIsEditDialogOpen(false);
      fetchQuestions();
      resetForm();
    } catch (error: any) {
      console.error('Error updating question:', error);
      setError(error.message);
      toast.error('Failed to update question');
    }
  };

  // Delete question
  const deleteQuestion = async () => {
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', selectedQuestionId);

      if (error) throw error;

      toast.success('Question deleted successfully');
      setIsDeleteDialogOpen(false);
      fetchQuestions();
    } catch (error: any) {
      console.error('Error deleting question:', error);
      setError(error.message);
      toast.error('Failed to delete question');
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      question_text: '',
      question_type: 'multiple_choice',
      options: [{}],
      correct_answers: [],
      time_limit: 30,
      difficulty: 'medium',
      is_active: true,
    });
    setSelectedQuestion(null);
  };

  // Open edit dialog
  const openEditDialog = (question: any) => {
    setSelectedQuestion(question);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type,
      options: question.options ||