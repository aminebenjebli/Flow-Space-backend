# Task Management System Documentation

## Overview

A complete NestJS Task module implementation with MongoDB/Prisma integration, featuring full CRUD operations, advanced filtering, search capabilities, and user-based access control.

## Features

### 🗂️ **Task Model** (`prisma/schema.prisma`)

- **ObjectId**: Primary key with `@id @default(auto()) @map("_id") @db.ObjectId`
- **User Relationship**: Foreign key `userId` as ObjectId string with cascade delete
- **Enums**: TaskStatus (TODO, IN_PROGRESS, DONE, CANCELLED) and TaskPriority (LOW, MEDIUM, HIGH, URGENT)
- **Timestamps**: Automatic `createdAt`, `updatedAt`, and optional `completedAt`
- **Indexes**: Optimized for querying by userId, status, priority, and dueDate

### 📝 **DTOs** (`src/modules/task/dto/task.dto.ts`)

- **CreateTaskDto**: Task creation with validation
- **UpdateTaskDto**: Partial updates with completion toggle
- **QueryTaskDto**: Advanced filtering and pagination
- **Enums**: TypeScript enums for TaskStatus and TaskPriority

### 🔧 **Service Layer** (`src/modules/task/task.service.ts`)

- **CRUD Operations**: Create, Read, Update, Delete with user ownership validation
- **Advanced Filtering**: Status, priority, date range, search, completion status
- **Pagination**: Configurable with max limit protection
- **Sorting**: Multiple fields with custom priority ordering
- **Statistics**: Task counts by status and overdue tracking
- **Bulk Operations**: Bulk status updates with ownership verification
- **Error Handling**: Comprehensive validation and user-friendly messages

### 🌐 **Controller Layer** (`src/modules/task/task.controller.ts`)

- **Authentication**: All endpoints protected by AuthGuard
- **User Context**: Automatic user extraction from JWT token
- **Swagger Documentation**: Complete API documentation
- **HTTP Standards**: Proper status codes and response formats

## API Endpoints

### Core CRUD Operations

```
POST   /tasks              - Create new task
GET    /tasks              - Get all tasks (with filters)
GET    /tasks/:id          - Get task by ID
PATCH  /tasks/:id          - Update task
DELETE /tasks/:id          - Delete task
```

### Additional Features

```
GET    /tasks/stats        - Get task statistics
PATCH  /tasks/bulk/status  - Bulk update task status
```

### Query Parameters (GET /tasks)

- `status`: Filter by TaskStatus
- `priority`: Filter by TaskPriority
- `search`: Search in title and description
- `dueFrom`/`dueUntil`: Date range filtering
- `completed`: Show only completed/incomplete tasks
- `page`/`limit`: Pagination (max 100 per page)
- `sortBy`/`sortOrder`: Sorting options

## Security Features

### 🔐 **Authentication & Authorization**

- **JWT Protection**: All endpoints require valid JWT token
- **User Isolation**: Users can only access their own tasks
- **Ownership Validation**: Automatic verification on all operations
- **Bulk Operation Safety**: Prevents unauthorized bulk updates

### 🛡️ **Input Validation**

- **Class Validators**: Comprehensive DTO validation
- **Length Limits**: Title (200 chars), Description (1000 chars)
- **Date Validation**: ISO date string validation
- **Enum Validation**: Strict status and priority validation

## Data Features

### 📊 **Advanced Querying**

- **Full-Text Search**: Case-insensitive search in title and description
- **Multi-Field Filtering**: Status, priority, dates, completion
- **Flexible Sorting**: createdAt, updatedAt, dueDate, priority
- **Efficient Pagination**: Skip/take with total count

### 📈 **Statistics**

- Total task count
- Breakdown by status (TODO, IN_PROGRESS, DONE, CANCELLED)
- Overdue task tracking
- User-specific metrics

### ⚡ **Performance Optimizations**

- **Database Indexes**: Strategic indexing for common queries
- **Parallel Queries**: Concurrent count and data fetching
- **Efficient Updates**: Targeted updates with minimal queries
- **Smart Completion**: Automatic timestamp management

## Usage Examples

### Creating a Task

```bash
POST /tasks
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "title": "Complete project documentation",
  "description": "Write comprehensive API documentation",
  "priority": "HIGH",
  "dueDate": "2025-12-31T23:59:59.000Z"
}
```

### Advanced Filtering

```bash
GET /tasks?status=TODO&priority=HIGH&search=documentation&page=1&limit=10&sortBy=dueDate&sortOrder=asc
Authorization: Bearer <jwt-token>
```

### Bulk Status Update

```bash
PATCH /tasks/bulk/status
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "taskIds": ["676...", "677..."],
  "status": "DONE"
}
```

## Module Architecture

### 📦 **TaskModule** (`src/modules/task/task.module.ts`)

- **Dependencies**: ConfigModule, JwtModule for authentication
- **Providers**: TaskService, PrismaService, AuthGuard
- **Exports**: TaskService for potential use in other modules

### 🔌 **Integration**

- **App Module**: Automatically imported and available
- **Database**: Uses existing PrismaService instance
- **Authentication**: Leverages existing AuthGuard implementation

## Database Schema

### Task Table Structure

```prisma
model Task {
  id          String       @id @default(auto()) @map("_id") @db.ObjectId
  title       String       // Required, 1-200 chars
  description String?      // Optional, max 1000 chars
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?    // Optional due date
  completedAt DateTime?    // Auto-set when marked complete
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  userId      String       @db.ObjectId // Foreign key
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([priority])
  @@index([dueDate])
}
```

## Error Handling

- **Not Found**: 404 for non-existent or unauthorized tasks
- **Validation**: 400 for invalid input data
- **Authorization**: 401 for missing/invalid tokens
- **Forbidden**: 403 for bulk operations on unauthorized tasks

## Testing Ready

The module is designed for easy testing with:

- Dependency injection for service mocking
- Clear separation of concerns
- Comprehensive error scenarios
- Predictable data validation

---

**Ready to use!** All endpoints are protected, documented, and follow REST best practices. The system ensures complete user data isolation while providing powerful task management capabilities.
