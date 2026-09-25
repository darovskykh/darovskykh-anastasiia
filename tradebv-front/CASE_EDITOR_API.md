# Case Editor API Integration

## Overview

The Case Editor component has been integrated with the backend API to support full CRUD operations for training cases and personas.

## Architecture

### Data Mapping Layer

The `caseMapper.ts` utility provides bidirectional mapping between:
- Frontend `TrainingCase` type (used in UI)
- Backend `Case` and `Persona` types (from API)

**Key Functions:**
- `apiToTrainingCase()` - Converts API response to UI format
- `trainingCaseToCaseCreate()` - Converts UI data to create request
- `trainingCaseToCaseUpdate()` - Converts UI data to update request
- `mockPersonaToPersonaCreate()` - Creates persona from UI data
- `mockPersonaToPersonaUpdate()` - Updates persona from UI data

### API Services

**Case Service** (`caseService.ts`):
- `getCaseAllData(caseId)` - Fetches case with all personas
- `createCase(data)` - Creates new case
- `updateCase(caseId, data)` - Updates existing case
- `deleteCase(caseId)` - Deletes case

**Persona Service** (`personaService.ts`):
- `createPersona(data)` - Creates new persona
- `updatePersona(personaId, data)` - Updates existing persona
- `deletePersona(personaId)` - Deletes persona

## Component Behavior

### Loading State
When editing an existing case, the component:
1. Shows loading spinner
2. Fetches case data via `getCaseAllData(caseId)`
3. Converts to UI format using `apiToTrainingCase()`
4. Populates form fields

### Saving
When saving:
1. Disables save button and shows spinner
2. For **Edit Mode**:
   - Updates case via `updateCase()`
   - Updates or creates persona as needed
3. For **Create Mode**:
   - Creates case via `createCase()`
   - Creates persona for the new case
4. Shows success/error toast
5. Navigates back to case management

### Error Handling
- Network errors show toast with error message
- Failed loads navigate back to case management
- All errors are logged to console

## Data Structure Notes

### Limitations
Current implementation has some limitations due to API schema differences:

1. **Scenarios** - Not yet supported in backend, stored empty array
2. **Evaluation Categories** - Not yet supported, stored empty array
3. **Statistics** - enrolledUsers, completedUsers, averageScore set to 0

### Persona Mapping
- `emotions` array of strings → UI emotion objects
- `actions` object → UI action objects
- `persona_description` + `goal_description` → combined description

## Future Improvements

1. Add support for scenarios in backend schema
2. Add support for evaluation categories
3. Implement statistics tracking
4. Add validation before save
5. Add auto-save draft functionality
6. Support for multiple personas per case
