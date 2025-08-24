# Healthcare Service Log Portal - Features Summary

## User Authentication & Access
- **Dual Login System**: Separate authentication for candidates (healthcare workers) and administrators
- **Role-Based Access**: Different interfaces and permissions based on user role
- **Session Management**: Secure login/logout with password reset capability

## Candidate Portal Features

### Service Log Form
- **Client Selection**: Dropdown menu to select client/site
- **Activity Selection**: Dropdown menu to select specialty/activity type
- **Patient Count Input**: Number field to specify total patients seen
- **Dynamic Patient Rows**: Form automatically generates individual patient entry rows based on count
- **Patient Data Entry**: Each row captures:
  - New patients (number)
  - Follow-up patients (number) 
  - DNA - Did Not Attend (number)
  - Outcome selection (dropdown)
- **Custom Fields**: Support for additional dropdown fields as configured by admin

### Form Management
- **Real-Time Validation**: Immediate feedback on form inputs
- **Save Draft**: Ability to save incomplete forms
- **Clear Form**: Reset form to empty state
- **Submission Confirmation**: Success message upon form completion

## Admin Portal Features

### Service Log Template Management
- **Client Management**: Add, edit, and remove client/site options
- **Activity Management**: Add, edit, and remove activity/specialty options
- **Outcome Management**: Add, edit, and remove outcome choices
- **Template Configuration**: Control what options appear in candidate dropdowns

### Dynamic Field Creation
- **Custom Dropdown Builder**: Create new dropdown fields with custom labels
- **Field Configuration**: Define the label and available choices for each custom field
- **Choice Management**: Add, edit, and remove options within custom dropdowns
- **Field Assignment**: Control which custom fields appear on the service log form

### User Management
- **User Creation**: Add new candidate accounts with email and password
- **User Administration**: Edit existing user details and permissions
- **Account Management**: Activate/deactivate user accounts

### Submission Management
- **Submission Log**: View all service log submissions in an easily accessible list
- **Filtering & Search**: Find specific submissions by date, user, client, or activity
- **View Details**: Access individual submission details for review
- **Data Export**: Export submission data for reporting purposes

## Core System Features
- **Mobile Responsive**: Fully functional on phones, tablets, and desktops
- **Data Validation**: Prevent invalid data entry and ensure data integrity
- **Error Handling**: User-friendly error messages and graceful failure handling
- **Data Persistence**: Reliable storage and retrieval of all form data and configurations
- **Extensible Design**: Easy to add new fields and modify templates without code changes