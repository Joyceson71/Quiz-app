'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
      options: question.options || [{}],
      correct_answers: question.correct_answers || [],
      time_limit: question.time_limit || 30,
      difficulty: question.difficulty || 'medium',
      is_active: question.is_active ?? true,
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (id: string) => {
    setSelectedQuestionId(id);
    setIsDeleteDialogOpen(true);
  };

  // Question form content (shared between create and edit)
  const QuestionFormContent = () => (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label>Question Text</Label>
        <Textarea
          name="question_text"
          placeholder="Enter your question..."
          value={formData.question_text}
          onChange={handleChange}
          rows={3}
          className="rounded-xl border-white/10 bg-white/5"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Difficulty</Label>
          <Select
            value={formData.difficulty}
            onValueChange={(val) => val && setFormData(prev => ({ ...prev, difficulty: val }))}
          >
            <SelectTrigger className="rounded-xl border-white/10 bg-white/5">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Time Limit (seconds)</Label>
          <Input
            name="time_limit"
            type="number"
            value={formData.time_limit}
            onChange={handleChange}
            className="rounded-xl border-white/10 bg-white/5"
          />
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Options</Label>
          <Button type="button" variant="outline" size="sm" onClick={addOption} className="rounded-lg text-xs">
            + Add Option
          </Button>
        </div>
        {formData.options.map((option: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold">
              {String.fromCharCode(65 + index)}
            </span>
            <Input
              placeholder={`Option ${String.fromCharCode(65 + index)}`}
              value={option.option_text || ''}
              onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
              className="flex-1 rounded-xl border-white/10 bg-white/5"
            />
            <div className="flex items-center gap-1.5">
              <Checkbox
                checked={option.is_correct || false}
                onCheckedChange={(checked) => handleOptionChange(index, 'is_correct', String(checked))}
              />
              <span className="text-xs text-muted-foreground">Correct</span>
            </div>
            {formData.options.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeOption(index)} className="text-red-400 hover:text-red-300">
                ×
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: !!checked }))}
        />
        <Label className="text-sm">Active (visible in quizzes)</Label>
      </div>
    </div>
  );

  if (loading && questions.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Questions</h1>
          <p className="text-muted-foreground">
            {totalQuestions} question{totalQuestions !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}
          className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white"
        >
          + Add Question
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Questions Table */}
      <Card className="border-white/5 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="w-12">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-24">Difficulty</TableHead>
                <TableHead className="w-20">Active</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q, index) => (
                <TableRow key={q.id} className="border-white/5 hover:bg-white/5">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {(currentPage - 1) * questionsPerPage + index + 1}
                  </TableCell>
                  <TableCell>
                    <p className="max-w-md truncate font-medium">{q.question_text || q.question}</p>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      q.difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400' :
                      q.difficulty === 'hard' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {q.difficulty || 'medium'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`h-2 w-2 rounded-full inline-block ${q.is_active !== false ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm hover:bg-muted">
                          ⋯
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => openEditDialog(q)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => openDeleteDialog(q.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {questions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    No questions found. Create your first question!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    isActive={currentPage === page}
                    onClick={() => setCurrentPage(page)}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Create Question Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Question</DialogTitle>
            <DialogDescription>Add a new question to the question bank.</DialogDescription>
          </DialogHeader>
          <QuestionFormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={createQuestion} className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>Update the question details.</DialogDescription>
          </DialogHeader>
          <QuestionFormContent />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={updateQuestion} className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Question</DialogTitle>
            <DialogDescription>
              Are you sure? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={deleteQuestion} className="rounded-xl bg-red-600 text-white hover:bg-red-700">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}