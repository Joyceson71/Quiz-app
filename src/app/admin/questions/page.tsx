'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  
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
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    question: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A',
    marks: 1,
  });

  const [aiFormData, setAiFormData] = useState({
    subject: '',
    department: '',
    difficulty: 'Medium',
    count: 5,
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
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'marks' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // Create question
  const createQuestion = async () => {
    try {
      const { error } = await supabase.from('questions').insert({
        question: formData.question,
        option_a: formData.option_a,
        option_b: formData.option_b,
        option_c: formData.option_c,
        option_d: formData.option_d,
        correct_answer: formData.correct_answer,
        marks: formData.marks,
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
          question: formData.question,
          option_a: formData.option_a,
          option_b: formData.option_b,
          option_c: formData.option_c,
          option_d: formData.option_d,
          correct_answer: formData.correct_answer,
          marks: formData.marks,
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
      question: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      marks: 1,
    });
    setSelectedQuestion(null);
  };

  // Open edit dialog
  const openEditDialog = (question: any) => {
    setSelectedQuestion(question);
    setFormData({
      question: question.question,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_answer: question.correct_answer,
      marks: question.marks || 1,
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
        <Label>Question</Label>
        <Textarea
          name="question"
          placeholder="Enter your question..."
          value={formData.question}
          onChange={handleChange}
          rows={3}
          className="rounded-xl border-white/10 bg-white/5"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Option A</Label>
          <Input
            name="option_a"
            value={formData.option_a}
            onChange={handleChange}
            className="rounded-xl border-white/10 bg-white/5"
          />
        </div>
        <div className="space-y-2">
          <Label>Option B</Label>
          <Input
            name="option_b"
            value={formData.option_b}
            onChange={handleChange}
            className="rounded-xl border-white/10 bg-white/5"
          />
        </div>
        <div className="space-y-2">
          <Label>Option C</Label>
          <Input
            name="option_c"
            value={formData.option_c}
            onChange={handleChange}
            className="rounded-xl border-white/10 bg-white/5"
          />
        </div>
        <div className="space-y-2">
          <Label>Option D</Label>
          <Input
            name="option_d"
            value={formData.option_d}
            onChange={handleChange}
            className="rounded-xl border-white/10 bg-white/5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Correct Answer</Label>
          <Select
            value={formData.correct_answer}
            onValueChange={(val) => val && handleSelectChange(val, 'correct_answer')}
          >
            <SelectTrigger className="rounded-xl border-white/10 bg-white/5">
              <SelectValue placeholder="Select correct answer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A">Option A</SelectItem>
              <SelectItem value="B">Option B</SelectItem>
              <SelectItem value="C">Option C</SelectItem>
              <SelectItem value="D">Option D</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Marks</Label>
          <Input
            name="marks"
            type="number"
            value={formData.marks}
            onChange={handleChange}
            className="rounded-xl border-white/10 bg-white/5"
          />
        </div>
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
        <div className="flex gap-3">
          <div>
            <input
              type="file"
              id="import-file"
              className="hidden"
              accept=".json,.csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                try {
                  const text = await file.text();
                  let questionsToImport = [];
                  
                  if (file.name.endsWith('.json')) {
                    questionsToImport = JSON.parse(text);
                  } else if (file.name.endsWith('.csv')) {
                    const lines = text.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim());
                    for (let i = 1; i < lines.length; i++) {
                      if (!lines[i].trim()) continue;
                      // Simple CSV parsing (doesn't handle quotes well but works for simple cases)
                      const values = lines[i].split(',').map(v => v.trim());
                      const obj: any = {};
                      headers.forEach((h, j) => {
                        obj[h] = values[j];
                      });
                      questionsToImport.push(obj);
                    }
                  }

                  if (!questionsToImport.length) throw new Error('No questions found');

                  // Validate and map
                  const validQuestions = questionsToImport.map((q: any) => ({
                    question: q.question,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    correct_answer: q.correct_answer || 'A',
                    marks: parseInt(q.marks) || 1,
                  }));

                  const { error } = await supabase.from('questions').insert(validQuestions);
                  if (error) throw error;
                  
                  toast.success(`Imported ${validQuestions.length} questions`);
                  fetchQuestions();
                } catch (error: any) {
                  console.error('Import error:', error);
                  toast.error(`Import failed: ${error.message}`);
                }
                
                // Reset input
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              className="rounded-xl border-white/10"
              onClick={() => document.getElementById('import-file')?.click()}
            >
              Import JSON/CSV
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setIsAiDialogOpen(true)}
            >
              ✨ Generate AI
            </Button>
          </div>
          <Button
            onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}
            className="rounded-xl bg-violet-600 hover:bg-violet-700"
          >
            Create Question
          </Button>
        </div>
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
                <TableHead className="w-24 text-center">Correct</TableHead>
                <TableHead className="w-20 text-center">Marks</TableHead>
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
                    <p className="max-w-md truncate font-medium">{q.question}</p>
                  </TableCell>
                  <TableCell className="text-center font-bold text-emerald-400">
                    {q.correct_answer}
                  </TableCell>
                  <TableCell className="text-center">
                    {q.marks}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-sm hover:bg-white/10">
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

      {/* AI Generate Dialog */}
      <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
        <DialogContent className="border-white/10 bg-background/95 backdrop-blur-xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">✨ Generate Questions with AI</DialogTitle>
            <DialogDescription>
              Automatically generate multiple-choice questions for any subject.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Subject / Topic</Label>
              <Input
                value={aiFormData.subject}
                onChange={(e) => setAiFormData({...aiFormData, subject: e.target.value})}
                placeholder="e.g. Data Structures, ReactJS, Machine Learning"
                className="rounded-xl border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select value={aiFormData.difficulty} onValueChange={(val) => val && setAiFormData({...aiFormData, difficulty: val})}>
                <SelectTrigger className="rounded-xl border-white/10 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Questions</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={aiFormData.count}
                onChange={(e) => setAiFormData({...aiFormData, count: parseInt(e.target.value) || 5})}
                className="rounded-xl border-white/10 bg-white/5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAiDialogOpen(false)} className="rounded-xl border-white/10">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!aiFormData.subject) return toast.error('Subject is required');
                setIsGeneratingAi(true);
                try {
                  const res = await fetch('/api/questions/generate', {
                    method: 'POST',
                    body: JSON.stringify(aiFormData),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed');
                  if (data.message) toast.info(data.message);
                  
                  // Insert mock questions
                  if (data.questions?.length) {
                    const { error } = await supabase.from('questions').insert(data.questions);
                    if (error) throw error;
                    toast.success(`Generated and saved ${data.questions.length} questions`);
                    fetchQuestions();
                    setIsAiDialogOpen(false);
                  }
                } catch (error: any) {
                  toast.error(error.message);
                } finally {
                  setIsGeneratingAi(false);
                }
              }}
              disabled={isGeneratingAi || !aiFormData.subject}
              className="rounded-xl bg-amber-500 text-black hover:bg-amber-600"
            >
              {isGeneratingAi ? 'Generating...' : 'Generate Questions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}