# Task Manager MVP Spec

## Product Goal

Build a personal task manager that helps a single user decide what to do next across work and life. The MVP should optimize for clarity, quick capture, and daily decision-making rather than team collaboration or deep automation.

## Primary User

- Solo user managing personal and professional tasks across multiple projects

## Core User Needs

- Capture tasks quickly without losing context
- See what is urgent, important, blocked, or delegated
- Organize work by project/area
- Review tasks in daily and weekly contexts
- Understand workload at a glance

## MVP Scope

### Included

- Multi-project task management
- Inbox capture
- Task list with status, priority, due date, and dependency metadata
- Smart dashboard with Today, Upcoming, Waiting, Delegated, and Overdue summaries
- Project views
- Calendar view for due dates
- Minimal "smart capture" preview using structured task defaults and natural-language-friendly input

### Excluded

- Authentication
- Real backend or sync
- Multi-user collaboration
- Real voice transcription
- External calendar integrations
- Advanced AI task parsing or agent workflows

## Information Architecture

### Main Screens

- Dashboard
- Inbox
- All Tasks
- Projects
- Calendar

### Global UI Principles

- Modern minimalist interface
- Calm visual hierarchy
- Fast scanning
- Low-friction capture
- Dense enough for productivity, not cluttered

## Data Model

### Project

- `id`
- `name`
- `type`: work, personal, side-project
- `color`

### Task

- `id`
- `title`
- `description`
- `projectId`
- `status`: inbox, next, in-progress, waiting, blocked, delegated, done
- `priority`: critical, high, medium, low
- `dueDate`
- `startDate`
- `owner`
- `dependencyLabel`
- `effort`: quick, medium, deep
- `tags`
- `scheduledDate`

## Key Product Rules

- Inbox is the default landing state for uncategorized capture.
- Tasks marked `waiting`, `blocked`, or `delegated` should never dominate the main action list.
- Dashboard should surface the most actionable tasks first.
- Due date and scheduled date are separate concepts.
- Each task belongs to one primary project.
- Priority is user-defined in MVP, with lightweight urgency indicators derived from due date.

## Dashboard Requirements

Dashboard should answer:

- What should I do today?
- What is due soon?
- What is blocked or waiting?
- Which projects need attention?

### Sections

- Top priorities
- Due today / overdue
- Waiting / delegated follow-ups
- Project workload summary
- Quick capture panel

## Calendar Requirements

- Weekly layout
- Show task deadlines on their dates
- Show scheduled tasks separately from plain due items when available
- Selecting a day filters visible tasks

## Capture Requirements

- Quick add field should accept natural language
- Example: "Send Flywheel proposal by Thursday, waiting on numbers"
- MVP behavior:
- Store raw input
- Infer a likely project using keyword matching
- Infer due date only when clearly present in seeded/demo behavior
- Put new items in Inbox unless explicitly set otherwise

## UI System

- Neutral palette with one strong accent
- Clean spacing scale
- Rounded cards and inputs
- Large, readable headings
- Subtle shadows and borders
- Responsive layout for desktop and tablet first, mobile-friendly

## Seeded Demo Content

Use realistic seeded tasks across:

- Personal
- Flywheel
- Consulting
- One side project

Seed data should demonstrate:

- Overdue work
- Due today
- Waiting on someone
- Delegated item
- Deep-work item
- Quick win

## Implementation Plan

### Phase 1

- Scaffold frontend app
- Create data model and seed data
- Build layout shell and navigation
- Build dashboard and task list views

### Phase 2

- Build project detail and calendar view
- Add quick capture and task creation flow
- Add filtering and task status updates

### Phase 3

- Improve natural-language parsing behavior
- Add local persistence
- Polish responsive behavior and UI states
