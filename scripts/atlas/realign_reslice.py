# Reslices an image and its label map into the MNI-aligned frame from realign_reg.py.
# Usage: python3 realign_reslice.py <image> <labels> <tfm> <out stem> [spacing x,y,z]
import SimpleITK as sitk, numpy as np, sys, itertools
src,lab,tfm,out=sys.argv[1:5]; sp=[float(x) for x in sys.argv[5].split(',')] if len(sys.argv)>5 else [0.5,0.5,0.6]
mov=sitk.ReadImage(src,sitk.sitkFloat32); tr=sitk.ReadTransform(tfm); inv=tr.GetInverse()
# extent of moving image corners in MNI space
sz=mov.GetSize(); pts=[inv.TransformPoint(mov.TransformContinuousIndexToPhysicalPoint([c*(s-1) for c,s in zip(cc,sz)])) for cc in itertools.product([0,1],repeat=3)]
lo=np.min(pts,0); hi=np.max(pts,0)
size=[int(np.ceil((h-l)/s))+1 for l,h,s in zip(lo,hi,sp)]
ref=sitk.Image(size,sitk.sitkFloat32); ref.SetSpacing(sp); ref.SetOrigin(lo.tolist()); ref.SetDirection([1,0,0,0,1,0,0,0,1])
bg=-1024 if mov.GetPixel(0,0,0)<-500 else 0
img=sitk.Resample(mov,ref,tr,sitk.sitkBSpline,bg)
L=sitk.ReadImage(lab); labr=sitk.Resample(L,ref,tr,sitk.sitkNearestNeighbor,0)
# trim slabs that fall outside the acquired volume (mostly background)
a=sitk.GetArrayFromImage(img); valid=a>bg+1
zs=np.where(valid.mean((1,2))>0.25)[0]; ys=np.where(valid.mean((0,2))>0.25)[0]; xs=np.where(valid.mean((0,1))>0.25)[0]
crop=lambda im:im[int(xs[0]):int(xs[-1])+1,int(ys[0]):int(ys[-1])+1,int(zs[0]):int(zs[-1])+1]
img=crop(img); labr=crop(labr)
sitk.WriteImage(img,out+'_img.nii.gz'); sitk.WriteImage(sitk.Cast(labr,sitk.sitkUInt8),out+'_lab.nii.gz')
print(out,img.GetSize(),'labels',len(np.unique(sitk.GetArrayFromImage(labr))))
