import React from 'react';
import { Search, Filter, MoreVertical, Plus } from 'lucide-react';
import './Employees.css';

const Employees = () => {
  return (
    <div className="employees-page">
      <div className="page-header mb-6">
        <div>
          <h1>Employee Management</h1>
          <p className="text-secondary mt-1">Manage and view employee directory</p>
        </div>
        <button className="btn-primary">
          <Plus size={18} /> Add Employee
        </button>
      </div>

      <div className="employees-card card">
        <div className="table-controls mb-4">
          <div className="search-bar-table">
            <Search size={18} className="text-secondary" />
            <input type="text" placeholder="Search by name, ID or department..." />
          </div>
          <button className="btn-outline">
            <Filter size={18} /> Filter
          </button>
        </div>

        <div className="table-responsive">
          <table className="employees-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <EmployeeRow 
                name="Vijay Kumar"
                role="Senior Frontend Developer"
                id="EMP-1042"
                dept="Engineering"
                attendance="95%"
                status="Active"
              />
              <EmployeeRow 
                name="Sarah Jenkins"
                role="Product Manager"
                id="EMP-1021"
                dept="Product"
                attendance="88%"
                status="Active"
              />
              <EmployeeRow 
                name="Michael Scott"
                role="Regional Manager"
                id="EMP-0945"
                dept="Management"
                attendance="100%"
                status="Active"
              />
              <EmployeeRow 
                name="Anita Patel"
                role="HR Executive"
                id="EMP-1102"
                dept="Human Resources"
                attendance="72%"
                status="On Leave"
              />
              <EmployeeRow 
                name="John Doe"
                role="QA Engineer"
                id="EMP-1156"
                dept="Engineering"
                attendance="0%"
                status="Inactive"
              />
            </tbody>
          </table>
        </div>

        <div className="pagination mt-4">
          <span className="text-secondary text-sm">Showing 1 to 5 of 45 entries</span>
          <div className="page-controls">
            <button className="page-btn" disabled>Prev</button>
            <button className="page-btn active">1</button>
            <button className="page-btn">2</button>
            <button className="page-btn">3</button>
            <span className="page-dots">...</span>
            <button className="page-btn">9</button>
            <button className="page-btn">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmployeeRow = ({ name, role, id, dept, attendance, status }) => {
  const getStatusClass = () => {
    switch(status) {
      case 'Active': return 'status-active';
      case 'On Leave': return 'status-leave';
      case 'Inactive': return 'status-inactive';
      default: return '';
    }
  };

  return (
    <tr>
      <td>
        <div className="emp-info">
          <div className="emp-avatar">{name.charAt(0)}</div>
          <div>
            <div className="emp-name">{name}</div>
            <div className="emp-role">{role}</div>
          </div>
        </div>
      </td>
      <td>{id}</td>
      <td>{dept}</td>
      <td>
        <div className="attendance-pill">{attendance}</div>
      </td>
      <td>
        <span className={`emp-status ${getStatusClass()}`}>{status}</span>
      </td>
      <td>
        <button className="action-btn">
          <MoreVertical size={18} />
        </button>
      </td>
    </tr>
  );
};

export default Employees;
