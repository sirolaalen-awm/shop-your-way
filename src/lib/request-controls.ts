import type {Intent} from './domain';
import {seedRequest,type ShoppingRequest,type RequestEdit} from './shopping-request';

// Only complete, unambiguous control messages bypass the model.
// A message containing another product or extra criteria stays on the normal path.
export function immediateRequestEdit(intent:Intent,current:ShoppingRequest|undefined,text:string):RequestEdit|null{
 if(!intent.goal)return null;
 const message=text.trim();
 const edit:RequestEdit={action:'REFINE',product:null,changes:[],budget:null,retainBudgetSource:null,journey:null,question:null};
 if(/^(?:cijena nije bitna|bez limita|no price limit|no budget limit|price does not matter)[.!]?$/i.test(message)){
  return {...edit,budget:{amount:null,source:text}};
 }
 const price=message.match(/^(?:do|under|up to|max(?:imum)?|budget(?: is|:)?|bud\u017eet(?: je|:)?)\s*\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:USD|dolara|\$)?[.!]?$/i);
 if(price){
  const amount=Number(price[1].replace(',','.'));
  if(amount>0&&amount<=100000)return {...edit,budget:{amount,source:text}};
 }
 const size=message.match(/^(EU|US)\s*(?:broj|br\.?|size|veli\u010dina)?\s*[:#-]?\s*(\d{1,2}(?:[.,]5)?)[.!]?$/i);
 const footwear=current?.category?.path.some(c=>c.slug==='shoes')||/shoe|boot|heel|pump|cipel|obu\u0107/i.test(intent.goal);
 if(size&&footwear){
  const value=Number(size[2].replace(',','.'));
  if(value<=0||value>60)return null;
  const request=current||seedRequest(intent);
  edit.changes=request.slots.filter(slot=>slot.key!=='shoe_size'&&/^(EU|US)\s*\d+(?:[.,]5)?$/i.test(slot.value)).map(slot=>({key:slot.key,label:slot.label,value:null,source:text}));
  edit.changes.push({key:'shoe_size',label:'Shoe size',value:size[1].toUpperCase()+' '+String(value),source:text});
  return edit;
 }
 return null;
}
