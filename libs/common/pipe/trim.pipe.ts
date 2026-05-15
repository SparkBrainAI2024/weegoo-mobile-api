import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (!this.isPlainObject(value)) {
      return value; // Only process plain objects
    }
    return this.trimObject(value, new WeakSet());
  }

  private trimObject(obj: any, visited: WeakSet<any>): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.trimObject(item, visited));
    } else if (this.isPlainObject(obj)) {
      // Check for circular references
      if (visited.has(obj)) {
        return obj; // Skip processing if object has already been visited
      }
      visited.add(obj);

      return Object.keys(obj).reduce((acc, key) => {
        const value = obj[key];
        acc[key] = typeof value === 'string' ? value.trim() : this.trimObject(value, visited);
        return acc;
      }, {});
    }
    return obj;
  }

  private isPlainObject(obj: any): boolean {
    // Ensures the object is a plain JavaScript object
    return obj && typeof obj === 'object' && obj.constructor === Object;
  }
}
