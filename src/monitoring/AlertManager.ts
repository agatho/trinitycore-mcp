import { EventEmitter } from 'events';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged'
}

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  source: string;
  timestamp: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  name: string;
  condition: (metrics: any) => boolean;
  severity: AlertSeverity;
  message: string;
  cooldown?: number;
}

export interface AlertChannel {
  name: string;
  send(alert: Alert): Promise<void>;
}

export class ConsoleAlertChannel implements AlertChannel {
  public name = 'console';

  async send(alert: Alert): Promise<void> {
    const severityUpper = alert.severity.toUpperCase();
    console.log('[ALERT ' + severityUpper + '] ' + alert.name + ': ' + alert.message);
  }
}

export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private channels: AlertChannel[] = [];
  private lastTriggered: Map<string, Date> = new Map();

  constructor() {
    super();
    this.addChannel(new ConsoleAlertChannel());
  }

  registerRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
    this.emit('rule-registered', { name: rule.name });
  }

  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  async createAlert(name: string, severity: AlertSeverity, message: string, source: string, metadata?: Record<string, any>): Promise<Alert> {
    const alertId = name + '-' + Date.now();
    const alert: Alert = {
      id: alertId,
      name,
      severity,
      status: AlertStatus.ACTIVE,
      message,
      source,
      timestamp: new Date(),
      metadata
    };

    this.alerts.set(alert.id, alert);
    this.emit('alert-created', { alert });
    await this.notifyChannels(alert);
    return alert;
  }

  private async notifyChannels(alert: Alert): Promise<void> {
    await Promise.all(
      this.channels.map(channel => 
        channel.send(alert).catch(error => {
          console.error('Channel ' + channel.name + ' failed:', error);
        })
      )
    );
  }

  resolveAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === AlertStatus.ACTIVE) {
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      this.emit('alert-resolved', { alert });
    }
  }

  evaluateRules(metrics: any): void {
    const now = new Date();

    for (const [name, rule] of this.rules.entries()) {
      const lastTrigger = this.lastTriggered.get(name);
      const cooldown = rule.cooldown || 300000;

      if (lastTrigger && (now.getTime() - lastTrigger.getTime() < cooldown)) {
        continue;
      }

      try {
        if (rule.condition(metrics)) {
          this.createAlert(name, rule.severity, rule.message, 'rule-engine');
          this.lastTriggered.set(name, now);
        }
      } catch (error) {
        console.error('Rule evaluation failed for ' + name + ':', error);
      }
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => a.status === AlertStatus.ACTIVE);
  }

  shutdown(): void {
    this.alerts.clear();
    this.rules.clear();
    this.channels = [];
    this.emit('shutdown');
  }
}

let globalAlertManager: AlertManager | null = null;

export function getAlertManager(): AlertManager {
  if (!globalAlertManager) {
    globalAlertManager = new AlertManager();
  }
  return globalAlertManager;
}
