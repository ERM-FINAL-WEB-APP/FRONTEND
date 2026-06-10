import React, { useState } from 'react';
import { ArrowLeft, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { complaintAPI } from '../services/api';
import Spinner from '../components/Spinner';
import './RaiseComplaint.css';

/**
 * RaiseComplaint — employee files a complaint that lands in the shared
 * `complaints` collection. HRMS's ComplainRegister page reads from the
 * same collection via its proxy, so the complaint shows up there
 * within seconds of submission.
 *
 * Backend endpoint: POST /api/complaint
 *   body: { subject, priority?, description? }
 *     priority is lowercase: 'low' | 'medium' | 'high' | 'critical'
 */
const RaiseComplaint = () => {
  const navigate = useNavigate();
  const [subject,     setSubject]     = useState('');
  const [priority,    setPriority]    = useState('Medium');
  const [description, setDescription] = useState('');
  const [busy,        setBusy]        = useState(false);
  const [error,       setError]       = useState('');
  const [done,        setDone]        = useState(false);

  const priorities = [
    { label: 'Low',      color: '#4CAA17' },
    { label: 'Medium',   color: '#FACC15' },
    { label: 'High',     color: '#F97316' },
    { label: 'Critical', color: '#EF4444' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!subject.trim()) {
      setError('Please enter a subject for your complaint.');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setError('Please describe the issue (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      // Backend stores priority lowercase. UI keeps "Medium" cap.
      await complaintAPI.create({
        subject:     subject.trim(),
        priority:    priority.toLowerCase(),
        description: description.trim(),
      });
      setDone(true);
      // Reset form for next submission.
      setTimeout(() => {
        setSubject('');
        setDescription('');
        setPriority('Medium');
        setDone(false);
        navigate(-1);
      }, 1800);
    } catch (err) {
      setError(err?.message || 'Could not submit complaint. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="complaint-page">
        <div className="complaint-content" style={{ textAlign: 'center', paddingTop: 80 }}>
          <CheckCircle size={72} color="#4CAA17" />
          <h1 className="complaint-title" style={{ marginTop: 16 }}>Complaint submitted</h1>
          <p className="complaint-desc">
            HR has been notified. You'll receive an update via Notifications when they respond.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="complaint-page">
      <div className="complaint-header-mobile">
        <button className="icon-btn-minimal" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
      </div>

      <div className="complaint-content">
        <h1 className="complaint-title">We're listening.</h1>
        <p className="complaint-desc">
          Your feedback helps us create a better workplace for everyone. Please provide the details below.
        </p>

        <form className="complaint-form" onSubmit={handleSubmit}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', borderRadius: 8,
              background: '#FEF2F2', border: '1px solid #FECACA',
              color: '#991B1B', fontSize: 13, marginBottom: 12,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              placeholder="e.g. Broken AC in Floor 3"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Priority Level</label>
            <div className="priority-options">
              {priorities.map(p => (
                <button
                  key={p.label}
                  type="button"
                  className={`priority-pill ${priority === p.label ? 'active' : ''}`}
                  onClick={() => setPriority(p.label)}
                  style={{ '--p-color': p.color }}
                >
                  <span className="priority-dot" style={{ backgroundColor: p.color }}></span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <div className="label-row">
              <label>Detailed Description</label>
              <span className="char-count">{description.length} / 500</span>
            </div>
            <textarea
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={8}
              required
            />
          </div>

          <div className="complaint-actions">
            <button type="submit" className="btn-submit-complaint" disabled={busy}>
              {busy ? <Spinner size={14} label="Submitting…" /> : (<>Submit Complaint <Send size={18} /></>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaiseComplaint;
