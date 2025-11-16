# Programs Dashboard

A comprehensive training programs management system with data entry and analytics dashboard.

## Features

- **Database Management**: Add, edit, delete, and import training programs
- **Analytics Dashboard**: Visual charts and KPIs for program insights
- **Revenue Tracking**: Multi-tier revenue calculation (participant fees + additional revenue)
- **Status Management**: Automatic status based on dates with manual override
- **Excel Integration**: Import data from Excel files
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Backend**: Node.js, Express, SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Charts**: Chart.js
- **Data Processing**: SheetJS (xlsx)
- **Deployment**: Docker + Coolify

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open in browser:
   - Database: http://localhost:3000/database.html
   - Dashboard: http://localhost:3000/index.html

## Coolify Deployment

### Prerequisites
- Coolify instance running
- Git repository with this code

### Deployment Steps

1. **Push code to Git repository**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```

2. **Create Coolify project**
   - Go to your Coolify dashboard
   - Click "Add Project" → "From Git Repository"
   - Connect your Git repository

3. **Configure the service**
   - **Service Type**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Port**: 3000
   - **Domain**: Choose your domain

4. **Environment Variables** (optional):
   - `DATABASE_PATH`: `/app/data/programs.db` (for persistent storage)
   - `NODE_ENV`: `production`

5. **Storage Configuration**
   - Add persistent storage volume:
     - **Path**: `/app/data`
     - **Mount Point**: `/app/data`
   - Add uploads volume:
     - **Path**: `/app/uploads`
     - **Mount Point**: `/app/uploads`

6. **Deploy**
   - Click "Deploy" in Coolify
   - Wait for build completion
   - Access your app at the configured domain

### Database Persistence

The SQLite database is stored in `/app/data/programs.db` which should be mounted to a persistent volume in Coolify to prevent data loss on container restarts.

### File Uploads

Excel file uploads are stored in `/app/uploads` and should also be mounted to persistent storage.

## API Endpoints

- `GET /api/programs` - Get all programs
- `POST /api/programs` - Add/update program
- `DELETE /api/programs/:program` - Delete program
- `POST /api/import` - Import from Excel
- `DELETE /api/programs` - Clear all programs

## Usage

1. **Data Entry**: Use `database.html` to manage program data
2. **Analytics**: Use `index.html` to view charts and KPIs
3. **Import**: Upload Excel files with program data
4. **Export**: Download filtered data as CSV or dashboard as PNG

## Data Structure

Programs table includes:
- Basic info: program name, participants, dates
- Demographics: male/female counts
- Trainers: local and expat trainer counts
- Revenue: participant fees, non-monetary, actual revenue
- Status: planned/completed based on dates

## License

MIT License