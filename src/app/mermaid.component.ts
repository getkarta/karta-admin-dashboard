import { Component, AfterViewInit, ElementRef, Input } from '@angular/core';
import mermaid from 'mermaid';

@Component({
  selector: 'app-mermaid',
  standalone: true, // ✅ Ensure it's standalone
  template: `<div #mermaidContainer class="mermaid"></div>`,
  styleUrls: ['./mermaid.component.css']
})
export class MermaidComponent implements AfterViewInit {
  @Input() diagram: string = '';

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    mermaid.initialize({ startOnLoad: false });

    setTimeout(() => {
      const element = this.el.nativeElement.querySelector('.mermaid');
      if (element) {
        element.innerHTML = this.diagram;
        mermaid.run(); // ✅ Ensure it processes the new content
      }
    }, 100); // Give some delay to avoid timing issues
  }
}
