import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Mail, Phone, MapPin, Upload, FileText } from 'lucide-react';
import './EmployeeDetail.css';

const EmployeeDetail = () => {
  const navigate = useNavigate();

  return (
    <div className="emp-detail-page">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back to Directory
      </button>

      <div className="emp-header">
        <div className="emp-header-left">
          <div className="emp-avatar-large">LF</div>
          <div className="emp-header-info">
            <h1>Liam Foster</h1>
            <div className="emp-meta">
              <span className="emp-designation">Frontend Dev</span>
              <span className="emp-status-badge">On Leave</span>
              <span className="emp-id-text">ID: EMP-1001</span>
            </div>
          </div>
        </div>
        <button className="btn-export">
          <Download size={16} /> Export CV
        </button>
      </div>

      <div className="emp-grid">
        {/* Left Column */}
        <div className="emp-col-left">
          {/* Contact Information */}
          <div className="card emp-card">
            <h3 className="card-title">Contact Information</h3>
            <div className="contact-list">
              <div className="contact-item">
                <div className="contact-icon"><Mail size={16} /></div>
                <div className="contact-text">
                  <span className="contact-label">EMAIL</span>
                  <span className="contact-val">liam@tesco.com</span>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon"><Phone size={16} /></div>
                <div className="contact-text">
                  <span className="contact-label">PHONE</span>
                  <span className="contact-val">+1 (555) 098-7654</span>
                </div>
              </div>
              <div className="contact-item">
                <div className="contact-icon"><MapPin size={16} /></div>
                <div className="contact-text">
                  <span className="contact-label">LOCATION</span>
                  <span className="contact-val">London, United Kingdom</span>
                </div>
              </div>
            </div>
          </div>

          {/* Productivity */}
          <div className="card emp-card">
            <h3 className="card-title">Productivity</h3>
            <div className="prod-stats">
              <div className="prod-stat">
                <span className="prod-val text-green">2.5</span>
                <span className="prod-lbl">CL</span>
              </div>
              <div className="prod-stat">
                <span className="prod-val text-purple">4.0h</span>
                <span className="prod-lbl">PERM</span>
              </div>
              <div className="prod-stat">
                <span className="prod-val text-blue">0</span>
                <span className="prod-lbl">COMP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="emp-col-right">
          {/* Employment Details */}
          <div className="card emp-card">
            <h3 className="card-title">Employment Details</h3>
            <div className="emp-details-grid">
              <div className="detail-item">
                <span className="detail-lbl">DEPARTMENT</span>
                <span className="detail-val">Engineering</span>
              </div>
              <div className="detail-item">
                <span className="detail-lbl">DESIGNATION</span>
                <span className="detail-val">Frontend Dev</span>
              </div>
              <div className="detail-item">
                <span className="detail-lbl">REPORTING TO</span>
                <span className="detail-val">Priya Sharma</span>
              </div>
              <div className="detail-item">
                <span className="detail-lbl">JOINING DATE</span>
                <span className="detail-val">2026-03-20</span>
              </div>
              <div className="detail-item">
                <span className="detail-lbl">EMPLOYMENT TYPE</span>
                <span className="detail-val">Full Time</span>
              </div>
              <div className="detail-item">
                <span className="detail-lbl">SALARY</span>
                <span className="detail-val">$5,200 / mo</span>
              </div>
            </div>
          </div>

          {/* Upcoming Leaves */}
          <div className="card emp-card">
            <h3 className="card-title">Upcoming Leaves</h3>
            <div className="leave-item">
              <div className="leave-info">
                <span className="leave-name">Summer Vacation</span>
                <span className="leave-dates">June 15 - June 20 (5 Days)</span>
              </div>
              <span className="leave-status">Approved</span>
            </div>
          </div>

          {/* Recent Documents */}
          <div className="card emp-card">
            <div className="card-header-flex">
              <h3 className="card-title">Recent Documents</h3>
              <button className="btn-outline-small">
                <Upload size={14} /> Upload Document
              </button>
            </div>
            <div className="doc-list">
              <div className="doc-item">
                <div className="doc-icon"><FileText size={20} className="text-green" /></div>
                <div className="doc-info">
                  <span className="doc-name">Offer Letter.pdf</span>
                  <span className="doc-meta">2.4 MB • Uploaded on Jan 05, 2023</span>
                </div>
                <button className="btn-icon"><Download size={16} /></button>
              </div>
              <div className="doc-item">
                <div className="doc-icon"><FileText size={20} className="text-green" /></div>
                <div className="doc-info">
                  <span className="doc-name">Performance Review Q1.pdf</span>
                  <span className="doc-meta">1.2 MB • Uploaded on Mar 31, 2024</span>
                </div>
                <button className="btn-icon"><Download size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetail;
