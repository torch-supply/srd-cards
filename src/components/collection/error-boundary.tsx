"use client";

import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { error: boolean }
> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
