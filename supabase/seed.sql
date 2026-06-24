-- ============================================
-- Seed Data: 20 Technical Quiz Questions
-- Technical Quiz Competition Platform
-- ============================================

INSERT INTO public.questions (question, option_a, option_b, option_c, option_d, correct_answer, marks, question_order) VALUES

-- 1. Data Structures
('What is the time complexity of searching for an element in a balanced Binary Search Tree (BST)?',
 'O(n)', 'O(log n)', 'O(n log n)', 'O(1)',
 'B', 1, 1),

-- 2. Algorithms
('Which sorting algorithm has the best average-case time complexity?',
 'Bubble Sort - O(n²)', 'Selection Sort - O(n²)', 'Merge Sort - O(n log n)', 'Insertion Sort - O(n²)',
 'C', 1, 2),

-- 3. Operating Systems
('Which scheduling algorithm may cause the "starvation" problem?',
 'Round Robin', 'Shortest Job First (SJF)', 'First Come First Serve (FCFS)', 'Multilevel Queue',
 'B', 1, 3),

-- 4. DBMS
('Which normal form eliminates transitive dependency?',
 'First Normal Form (1NF)', 'Second Normal Form (2NF)', 'Third Normal Form (3NF)', 'Boyce-Codd Normal Form (BCNF)',
 'C', 1, 4),

-- 5. Computer Networks
('Which layer of the OSI model is responsible for routing?',
 'Data Link Layer', 'Transport Layer', 'Network Layer', 'Session Layer',
 'C', 1, 5),

-- 6. OOP Concepts
('Which OOP principle allows a child class to provide a specific implementation of a method defined in its parent class?',
 'Encapsulation', 'Abstraction', 'Polymorphism', 'Inheritance',
 'C', 1, 6),

-- 7. Web Development
('What does the "DOM" stand for in web development?',
 'Document Object Model', 'Data Object Management', 'Document Oriented Middleware', 'Digital Output Module',
 'A', 1, 7),

-- 8. Computer Architecture
('How many bits are in one byte?',
 '4 bits', '8 bits', '16 bits', '32 bits',
 'B', 1, 8),

-- 9. Programming (C)
('What is the output of: printf("%d", 5 + 3 * 2)?',
 '16', '11', '13', '10',
 'B', 1, 9),

-- 10. Data Structures
('Which data structure uses LIFO (Last In, First Out) principle?',
 'Queue', 'Stack', 'Array', 'Linked List',
 'B', 1, 10),

-- 11. Algorithms
('What is the worst-case time complexity of Quick Sort?',
 'O(n log n)', 'O(n)', 'O(n²)', 'O(log n)',
 'C', 1, 11),

-- 12. Operating Systems
('Which of the following is NOT a type of operating system?',
 'Batch OS', 'Real-Time OS', 'Compiler OS', 'Distributed OS',
 'C', 1, 12),

-- 13. DBMS
('Which SQL command is used to remove all rows from a table without deleting the table structure?',
 'DELETE', 'DROP', 'TRUNCATE', 'REMOVE',
 'C', 1, 13),

-- 14. Computer Networks
('What is the maximum data rate of a standard CAT-6 Ethernet cable?',
 '100 Mbps', '1 Gbps', '10 Gbps', '100 Gbps',
 'C', 1, 14),

-- 15. Programming
('Which keyword is used to prevent a class from being inherited in Java?',
 'static', 'abstract', 'final', 'private',
 'C', 1, 15),

-- 16. Web Development
('Which HTTP status code indicates "Not Found"?',
 '200', '301', '404', '500',
 'C', 1, 16),

-- 17. Data Structures
('What is the minimum number of queues needed to implement a stack?',
 '1', '2', '3', '4',
 'B', 1, 17),

-- 18. Operating Systems
('What is a deadlock?',
 'A process that is running indefinitely', 'A situation where two or more processes are unable to proceed because each is waiting for the other', 'A process that has been terminated', 'A process waiting for I/O',
 'B', 1, 18),

-- 19. DBMS
('Which type of JOIN returns all records from both tables and fills in NULLs for missing matches?',
 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN',
 'D', 1, 19),

-- 20. Computer Networks
('What does DNS stand for?',
 'Data Network Service', 'Domain Name System', 'Digital Network Security', 'Dynamic Node Switching',
 'B', 1, 20);
